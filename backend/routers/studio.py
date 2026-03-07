from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from services.event_bus import TERMINAL_EVENT_TYPES, execution_event_broker
from services.workflow_engine import WorkflowEngine, WorkflowEngineError

try:
    from database import SessionLocal
    from db_models import (
        DeadLetterExecution,
        ExecutionRun,
        NodeExecutionLog,
        WorkflowDefinition,
        WorkflowEdgeDefinition,
        WorkflowNodeDefinition,
    )

    DB_AVAILABLE = True
except ImportError:
    SessionLocal = None
    WorkflowDefinition = None
    WorkflowNodeDefinition = None
    WorkflowEdgeDefinition = None
    ExecutionRun = None
    NodeExecutionLog = None
    DeadLetterExecution = None
    DB_AVAILABLE = False


router = APIRouter()

DEFAULT_EXECUTION_INPUT = {
    "application_id": "APP_001",
    "applicant_name": "Acme Corp",
    "requested_amount": 250000,
    "currency": "USD",
}


class ReactFlowNode(BaseModel):
    id: str
    type: str
    position: dict[str, float] = Field(default_factory=dict)
    data: dict[str, Any] = Field(default_factory=dict)


class ReactFlowEdge(BaseModel):
    id: str
    source: str
    target: str
    type: Optional[str] = "smoothstep"
    sourceHandle: Optional[str] = None
    targetHandle: Optional[str] = None
    animated: Optional[bool] = None
    style: dict[str, Any] = Field(default_factory=dict)


class DecisionGraphPayload(BaseModel):
    nodes: list[ReactFlowNode]
    edges: list[ReactFlowEdge]
    workflow_id: Optional[str] = None
    workflow_name: Optional[str] = "Untitled Workflow"
    workflow_status: Optional[str] = "draft"
    trigger_type: Optional[str] = "manual"
    initial_input: dict[str, Any] = Field(default_factory=dict)


def _model_dump(instance: Any) -> dict[str, Any]:
    if hasattr(instance, "model_dump"):
        return instance.model_dump()
    return instance.dict()


def _payload_to_dict(payload: DecisionGraphPayload) -> dict[str, Any]:
    return {
        "nodes": [_model_dump(node) for node in payload.nodes],
        "edges": [_model_dump(edge) for edge in payload.edges],
        "workflow_id": payload.workflow_id,
        "workflow_name": payload.workflow_name,
        "workflow_status": payload.workflow_status,
        "trigger_type": payload.trigger_type,
        "initial_input": dict(payload.initial_input or {}),
    }


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _compute_duration_ms(started_at: datetime | None, finished_at: datetime | None) -> int | None:
    if not started_at or not finished_at:
        return None
    return int((finished_at - started_at).total_seconds() * 1000)


def _build_initial_input(payload_dict: dict[str, Any]) -> dict[str, Any]:
    initial_input = dict(DEFAULT_EXECUTION_INPUT)
    initial_input.update(payload_dict.get("initial_input") or {})
    return initial_input


def _persist_workflow_snapshot(payload_dict: dict[str, Any]) -> None:
    if not DB_AVAILABLE:
        return

    workflow_id = payload_dict["workflow_id"]
    with SessionLocal() as session:
        workflow = session.get(WorkflowDefinition, workflow_id)
        if workflow is None:
            workflow = WorkflowDefinition(id=workflow_id)
            session.add(workflow)

        workflow.name = payload_dict.get("workflow_name") or workflow_id
        workflow.status = payload_dict.get("workflow_status") or "draft"
        workflow.trigger_type = payload_dict.get("trigger_type") or "manual"
        workflow.definition_json = {
            "nodes": payload_dict["nodes"],
            "edges": payload_dict["edges"],
        }
        workflow.updated_at = _utc_now()

        workflow.nodes.clear()
        workflow.edges.clear()
        session.flush()

        for node in payload_dict["nodes"]:
            workflow.nodes.append(
                WorkflowNodeDefinition(
                    node_id=node["id"],
                    node_type=node["type"],
                    label=(node.get("data") or {}).get("label"),
                    position_x=float((node.get("position") or {}).get("x", 0)),
                    position_y=float((node.get("position") or {}).get("y", 0)),
                    config_json=node.get("data") or {},
                    execution_config_json=((node.get("data") or {}).get("executionConfig") or {}),
                )
            )

        for edge in payload_dict["edges"]:
            workflow.edges.append(
                WorkflowEdgeDefinition(
                    edge_id=edge["id"],
                    source_node_id=edge["source"],
                    target_node_id=edge["target"],
                    source_handle=edge.get("sourceHandle"),
                    target_handle=edge.get("targetHandle"),
                    edge_type=edge.get("type"),
                    config_json={
                        key: value
                        for key, value in edge.items()
                        if key not in {"id", "source", "target", "sourceHandle", "targetHandle", "type"}
                    },
                )
            )

        session.commit()


def _seed_execution_run(execution_id: str, payload_dict: dict[str, Any], initial_input: dict[str, Any]) -> None:
    if not DB_AVAILABLE:
        return

    with SessionLocal() as session:
        execution = session.get(ExecutionRun, execution_id)
        if execution is None:
            execution = ExecutionRun(id=execution_id)
            session.add(execution)
        execution.workflow_id = payload_dict["workflow_id"]
        execution.trigger_type = payload_dict.get("trigger_type") or "manual"
        execution.status = "queued"
        execution.initial_payload_json = initial_input
        execution.updated_at = _utc_now()
        session.commit()


def _persist_event(execution_id: str, workflow_id: str, event: dict[str, Any]) -> None:
    if not DB_AVAILABLE:
        return

    with SessionLocal() as session:
        execution = session.get(ExecutionRun, execution_id)
        if execution is None:
            execution = ExecutionRun(id=execution_id, workflow_id=workflow_id)
            session.add(execution)

        event_type = event.get("type")
        if event_type == "execution.started":
            execution.status = "running"
            execution.started_at = datetime.fromisoformat(event["timestamp"])
        elif event_type == "execution.completed":
            execution.status = "success"
            execution.finished_at = datetime.fromisoformat(event["timestamp"])
            execution.duration_ms = _compute_duration_ms(execution.started_at, execution.finished_at)
            execution.final_payload_json = event.get("final_state")
            execution.tokens_consumed = int(event.get("tokens_consumed", execution.tokens_consumed or 0))
            execution.error_message = None
        elif event_type == "execution.failed":
            execution.status = "failed"
            execution.finished_at = datetime.fromisoformat(event["timestamp"])
            execution.duration_ms = _compute_duration_ms(execution.started_at, execution.finished_at)
            execution.error_message = event.get("error")
        elif event_type and event_type.startswith("node."):
            session.add(
                NodeExecutionLog(
                    execution_id=execution_id,
                    workflow_id=workflow_id,
                    node_id=event.get("node_id") or "unknown",
                    node_type=event.get("node_type") or "unknown",
                    event_type=event_type,
                    status=event.get("status") or "unknown",
                    attempt=int(event.get("attempt", 1) or 1),
                    input_payload_json=event.get("input"),
                    output_payload_json=event.get("output"),
                    source_edges_json=event.get("source_edges"),
                    error_message=event.get("error"),
                    started_at=datetime.fromisoformat(event["started_at"]) if event.get("started_at") else None,
                    finished_at=datetime.fromisoformat(event["finished_at"]) if event.get("finished_at") else None,
                    duration_ms=event.get("duration_ms"),
                )
            )

        execution.updated_at = _utc_now()
        session.commit()


def _persist_dead_letter(execution_id: str, workflow_id: str, initial_input: dict[str, Any], error_message: str) -> None:
    if not DB_AVAILABLE:
        return

    with SessionLocal() as session:
        dead_letter = session.query(DeadLetterExecution).filter_by(execution_id=execution_id).one_or_none()
        if dead_letter is None:
            dead_letter = DeadLetterExecution(execution_id=execution_id)
            session.add(dead_letter)
        dead_letter.workflow_id = workflow_id
        dead_letter.failure_stage = "workflow"
        dead_letter.reason = error_message
        dead_letter.payload_json = initial_input
        session.commit()


async def _emit_and_persist(execution_id: str, workflow_id: str, event: dict[str, Any]) -> None:
    await execution_event_broker.publish(execution_id, event)
    if DB_AVAILABLE:
        persisted_event = dict(event)
        persisted_event.setdefault("timestamp", _utc_now().isoformat())
        await asyncio.to_thread(_persist_event, execution_id, workflow_id, persisted_event)


async def _run_workflow_execution(execution_id: str, payload_dict: dict[str, Any], initial_input: dict[str, Any]) -> None:
    engine = WorkflowEngine(
        workflow_id=payload_dict["workflow_id"],
        nodes=payload_dict["nodes"],
        edges=payload_dict["edges"],
    )

    async def emit_event(event: dict[str, Any]) -> None:
        await _emit_and_persist(execution_id, payload_dict["workflow_id"], event)

    try:
        await engine.run(
            execution_id=execution_id,
            initial_input=initial_input,
            emit_event=emit_event,
        )
    except Exception as exc:
        error_message = str(exc)
        await emit_event(
            {
                "type": "execution.failed",
                "workflow_id": payload_dict["workflow_id"],
                "status": "failed",
                "message": error_message,
                "error": error_message,
                "final_state": {
                    "initial_input": initial_input,
                    "node_outputs": engine.node_outputs,
                    "node_status": engine.node_status,
                },
                "tokens_consumed": engine.tokens_consumed,
            }
        )
        if DB_AVAILABLE:
            await asyncio.to_thread(
                _persist_dead_letter,
                execution_id,
                payload_dict["workflow_id"],
                initial_input,
                error_message,
            )


@router.post("/estimate_cost")
async def estimate_workflow_cost(payload: DecisionGraphPayload):
    workflow_id = payload.workflow_id or "draft_preview"
    payload_dict = _payload_to_dict(payload)
    payload_dict["workflow_id"] = workflow_id
    engine = WorkflowEngine(workflow_id=workflow_id, nodes=payload_dict["nodes"], edges=payload_dict["edges"])
    return engine.estimate_cost()


@router.post("/executions")
async def create_execution(payload: DecisionGraphPayload):
    payload_dict = _payload_to_dict(payload)
    payload_dict["workflow_id"] = payload_dict.get("workflow_id") or f"draft_{uuid4().hex}"
    initial_input = _build_initial_input(payload_dict)
    execution_id = uuid4().hex

    await execution_event_broker.ensure_channel(execution_id)

    if DB_AVAILABLE:
        await asyncio.to_thread(_persist_workflow_snapshot, payload_dict)
        await asyncio.to_thread(_seed_execution_run, execution_id, payload_dict, initial_input)

    asyncio.create_task(_run_workflow_execution(execution_id, payload_dict, initial_input))

    return {
        "status": "accepted",
        "workflow_id": payload_dict["workflow_id"],
        "execution_id": execution_id,
        "websocket_path": f"/api/studio/executions/{execution_id}/ws",
    }


@router.post("/execute")
async def execute_workflow(payload: DecisionGraphPayload):
    return await create_execution(payload)


@router.post("/execute/sync")
async def execute_workflow_sync(payload: DecisionGraphPayload):
    payload_dict = _payload_to_dict(payload)
    payload_dict["workflow_id"] = payload_dict.get("workflow_id") or f"draft_{uuid4().hex}"
    initial_input = _build_initial_input(payload_dict)
    execution_id = uuid4().hex
    engine = WorkflowEngine(
        workflow_id=payload_dict["workflow_id"],
        nodes=payload_dict["nodes"],
        edges=payload_dict["edges"],
    )
    events: list[dict[str, Any]] = []

    async def capture_event(event: dict[str, Any]) -> None:
        stamped_event = dict(event)
        stamped_event.setdefault("timestamp", _utc_now().isoformat())
        events.append(stamped_event)

    try:
        result = await engine.run(
            execution_id=execution_id,
            initial_input=initial_input,
            emit_event=capture_event,
        )
        return {
            "status": "success",
            "execution_id": execution_id,
            "events": events,
            "result": result,
        }
    except WorkflowEngineError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/executions/{execution_id}")
async def get_execution_history(execution_id: str):
    history = await execution_event_broker.history(execution_id)
    if not history:
        raise HTTPException(status_code=404, detail="Execution not found")
    return {"execution_id": execution_id, "events": history}


@router.websocket("/executions/{execution_id}/ws")
async def execution_stream(websocket: WebSocket, execution_id: str):
    await websocket.accept()
    try:
        async with execution_event_broker.subscribe(execution_id) as (history, queue):
            for event in history:
                await websocket.send_json(event)

            if history and history[-1].get("type") in TERMINAL_EVENT_TYPES:
                return

            while True:
                event = await queue.get()
                await websocket.send_json(event)
                if event.get("type") in TERMINAL_EVENT_TYPES:
                    break
    except WebSocketDisconnect:
        return

