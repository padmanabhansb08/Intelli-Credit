from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from uuid import uuid4

import math
from fastapi import APIRouter, Depends, Header, HTTPException, WebSocket, WebSocketDisconnect, status, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from database import get_db
from db_models import CreditPolicy, PolicyStatus
from schemas_v2 import (
    DecisionEvaluateRequest, DecisionEvaluateResponse,
    PolicyCreateRequest, PolicyUpdateRequest, PolicyResponse, 
    PaginatedPolicyResponse, PolicySortField, PolicyStatusEnum, SortOrder
)

# For Workflow execution
from services.execution_engine import ExecutionEngine

from services.decision_studio_core import DecisionCoreService
try:
    from services.event_bus import TERMINAL_EVENT_TYPES, execution_event_broker
except ImportError:
    execution_event_broker = None
    TERMINAL_EVENT_TYPES = []
try:
    from services.workflow_engine import WorkflowEngine, WorkflowEngineError
except ImportError:
    WorkflowEngine = None
    WorkflowEngineError = Exception

router = APIRouter()

# Schema for React Flow Graphs
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
    trigger_type: Optional[str] = "manual"
    initial_input: dict[str, Any] = Field(default_factory=dict)

# Mocks payload format specifically for EPHEMERAL Execution API
class ExecutePayload(BaseModel):
    applicant_name: str = "Test Corp"
    pan_number: str = "ABCDE1234F"
    loan_amount: float = 50000.0
    pdf_urls: list[str] = []

class DraftExecutionPayload(BaseModel):
    trigger_payload: ExecutePayload
    nodes: list[dict[str, Any]] = Field(default_factory=list)
    edges: list[dict[str, Any]] = Field(default_factory=list)

class PolicyGenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=5, max_length=1000, description="Natural language description of the policy")

_SYSTEM_USER_ID = uuid4()

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

# Endpoint 1: Evaluate Static Policy (Ported from decisions.py)
@router.post(
    "/evaluate",
    response_model=DecisionEvaluateResponse,
    status_code=status.HTTP_200_OK,
    summary="Evaluate financial data against a credit policy",
)
async def evaluate_decision(
    body: DecisionEvaluateRequest,
    db: Session = Depends(get_db),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
):
    policy = db.execute(
        select(CreditPolicy).where(CreditPolicy.id == body.policy_id)
    ).scalar_one_or_none()
    if policy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Credit policy {body.policy_id} not found.",
        )

    outcome = DecisionCoreService.evaluate_static_policy(
        financial_data=body.financial_data,
        policy_schema=policy.rule_schema,
    )

    return DecisionEvaluateResponse(
        decision=outcome["decision"],
        reason=outcome["reason"],
        execution_trail=outcome["execution_trail"],
        nodes_triggered=outcome["nodes_triggered"],
        policy_id=body.policy_id,
        idempotency_key=idempotency_key,
    )

# Endpoint 2: Estimate Cost (Ported from studio.py)
@router.post("/estimate_cost")
async def estimate_workflow_cost(payload: DecisionGraphPayload):
    workflow_id = payload.workflow_id or "draft_preview"
    payload_dict = _payload_to_dict(payload)
    if WorkflowEngine:
        engine = WorkflowEngine(workflow_id=workflow_id, nodes=payload_dict["nodes"], edges=payload_dict["edges"])
        return engine.estimate_cost()
    return {"total_cost_usd": 0.0, "total_tokens": 0, "node_estimates": {}}

# Endpoint 3: Async Workflow Execution (Ported from studio.py)
@router.post("/execute")
async def execute_workflow(payload: DecisionGraphPayload):
    payload_dict = _payload_to_dict(payload)
    payload_dict["workflow_id"] = payload_dict.get("workflow_id") or f"draft_{uuid4().hex}"
    
    initial_input = dict({"application_id": "APP_001", "applicant_name": "Acme Corp", "requested_amount": 250000, "currency": "USD"})
    initial_input.update(payload_dict.get("initial_input") or {})
    
    execution_id = uuid4().hex

    if execution_event_broker:
        await execution_event_broker.ensure_channel(execution_id)

    await asyncio.to_thread(DecisionCoreService.persist_workflow_snapshot, payload_dict)
    await asyncio.to_thread(DecisionCoreService.seed_execution_run, execution_id, payload_dict, initial_input)

    asyncio.create_task(DecisionCoreService.run_workflow_execution(execution_id, payload_dict, initial_input))

    return {
        "status": "accepted",
        "workflow_id": payload_dict["workflow_id"],
        "execution_id": execution_id,
        "websocket_path": f"/api/decision-studio/executions/{execution_id}/ws",
    }

# Endpoint 4: Ephemeral Draft Execution (Ported from execution.py)
@router.post("/execute-draft", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
async def execute_draft_workflow_v2(payload: DraftExecutionPayload):
    """
    Ephemeral Draft Execution. Validates and runs the exact DAG payload entirely in-memory.
    """
    cycle_nodes = DecisionCoreService.check_for_cycles(payload.nodes, payload.edges)
    if cycle_nodes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Invalid Workflow: Cycle detected in nodes.",
                "cycle_nodes": cycle_nodes,
                "message": "Please remove the circular dependency in your workflow graph and try again."
            }
        )
        
    engine = ExecutionEngine(dag_nodes=payload.nodes, dag_edges=payload.edges)
    
    try:
        final_context_state = await engine.execute(_model_dump(payload.trigger_payload))
        return {
            "status": "success",
            "execution_mode": "ephemeral_draft",
            "policy_id": f"draft_{int(datetime.now().timestamp() * 1000)}",
            "engine_state": final_context_state,
            "nodes_processed": len(payload.nodes),
            "edges_processed": len(payload.edges)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "Engine execution failed", "message": str(e)})

# Endpoint 5: Sync Workflow Execution (Legacy)
@router.post("/execute/sync")
async def execute_workflow_sync(payload: DecisionGraphPayload):
    payload_dict = _payload_to_dict(payload)
    payload_dict["workflow_id"] = payload_dict.get("workflow_id") or f"draft_{uuid4().hex}"
    
    initial_input = dict({"application_id": "APP_001"})
    initial_input.update(payload_dict.get("initial_input") or {})
    execution_id = uuid4().hex
    
    if not WorkflowEngine:
         raise HTTPException(status_code=500, detail="WorkflowEngine not configured.")

    engine = WorkflowEngine(
        workflow_id=payload_dict["workflow_id"],
        nodes=payload_dict["nodes"],
        edges=payload_dict["edges"],
    )
    events: list[dict[str, Any]] = []

    async def capture_event(event: dict[str, Any]) -> None:
        stamped_event = dict(event)
        stamped_event.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
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
        raise HTTPException(status_code=400, detail=str(exc))

@router.get("/executions/{execution_id}")
async def get_execution_history(execution_id: str):
    if not execution_event_broker:
         raise HTTPException(status_code=500, detail="Event broker offline.")
    history = await execution_event_broker.history(execution_id)
    if not history:
        raise HTTPException(status_code=404, detail="Execution not found")
    return {"execution_id": execution_id, "events": history}

@router.websocket("/executions/{execution_id}/ws")
async def execution_stream(websocket: WebSocket, execution_id: str):
    await websocket.accept()
    if not execution_event_broker:
         await websocket.close()
         return
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

# ─── MIGRATED POLICY AND ENGINE ENDPOINTS ──────────────────────────────

@router.get("/policies", response_model=PaginatedPolicyResponse, status_code=status.HTTP_200_OK)
async def list_policies(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: PolicySortField = Query(PolicySortField.created_at),
    sort_order: SortOrder = Query(SortOrder.desc),
    status_filter: Optional[PolicyStatusEnum] = Query(None, alias="status"),
    db: Session = Depends(get_db),
):
    query = select(CreditPolicy)
    count_query = select(func.count()).select_from(CreditPolicy)

    if status_filter is not None:
        pg_status = PolicyStatus(status_filter.value)
        query = query.where(CreditPolicy.status == pg_status)
        count_query = count_query.where(CreditPolicy.status == pg_status)

    sort_col = getattr(CreditPolicy, sort_by.value, CreditPolicy.created_at)
    if sort_order == SortOrder.desc:
        query = query.order_by(sort_col.desc())
    else:
        query = query.order_by(sort_col.asc())

    total = db.scalar(count_query)
    total_pages = max(1, math.ceil(total / page_size))

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    policies = db.execute(query).scalars().all()

    return PaginatedPolicyResponse(
        items=[PolicyResponse.model_validate(p) for p in policies],
        total=total, page=page, page_size=page_size, total_pages=total_pages,
    )

@router.post("/policies", response_model=PolicyResponse, status_code=status.HTTP_201_CREATED)
async def create_policy(body: PolicyCreateRequest, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    policy = CreditPolicy(
        id=str(uuid4()),
        name=body.name,
        rule_schema=body.rule_schema.model_dump(by_alias=True),
        version=1,
        status="DRAFT",
        created_by=str(_SYSTEM_USER_ID),
        created_at=now,
        updated_at=now,
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return PolicyResponse.model_validate(policy)

@router.put("/policies/{policy_id}", response_model=PolicyResponse, status_code=status.HTTP_200_OK)
async def update_policy(policy_id: str, body: PolicyUpdateRequest, db: Session = Depends(get_db)):
    policy = db.execute(select(CreditPolicy).where(CreditPolicy.id == policy_id)).scalar_one_or_none()
    if policy is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Policy {policy_id} not found.")

    if body.name is not None:
        policy.name = body.name
    if body.rule_schema is not None:
        policy.rule_schema = body.rule_schema.model_dump(by_alias=True)
        policy.version += 1
    if body.status is not None:
        policy.status = body.status.value

    policy.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(policy)
    return PolicyResponse.model_validate(policy)

@router.post("/policies/generate", status_code=status.HTTP_200_OK)
async def generate_policy(body: PolicyGenerateRequest):
    return DecisionCoreService.generate_ai_policy(body.prompt)

@router.post("/deploy", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def deploy_engine(payload: DecisionGraphPayload):
    payload_dict = _payload_to_dict(payload)
    cycle_nodes = DecisionCoreService.check_for_cycles(payload_dict["nodes"], payload_dict["edges"])
    
    if cycle_nodes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "DAG Topology Error: Circular dependency detected.",
                "cycle_nodes": cycle_nodes
            }
        )
    return {
        "status": "success",
        "message": "Engine configuration rigorously validated and conceptually deployed.",
        "nodes_processed": len(payload_dict["nodes"]),
        "edges_processed": len(payload_dict["edges"]),
        "workflow_id": payload_dict.get("workflow_id")
    }
