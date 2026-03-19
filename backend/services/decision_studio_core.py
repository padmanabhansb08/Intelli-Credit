from typing import Any, Dict, Optional, List
import asyncio
from datetime import datetime, timezone
import os
import json
from uuid import uuid4
from groq import Groq
from schemas_v2 import PolicyRuleSchema, ALLOWED_OPERATORS
from pydantic import ValidationError
from fastapi import HTTPException, status
try:
    from dynamic_scorer import evaluate_policy
except ImportError:
    def evaluate_policy(*args, **kwargs):
        return {"decision": "ERROR", "reason": "dynamic_scorer not found", "execution_trail": [], "nodes_triggered": []}

# Import from existing workflow_engine
try:
    from services.workflow_engine import WorkflowEngine, WorkflowEngineError
    from services.event_bus import execution_event_broker, TERMINAL_EVENT_TYPES
except ImportError:
    WorkflowEngine = None
    WorkflowEngineError = Exception
    execution_event_broker = None
    TERMINAL_EVENT_TYPES = []

try:
    from database import SessionLocal
    from db_models import (
        WorkflowDefinition,
        ExecutionRun,
        WorkflowNodeDefinition,
        WorkflowEdgeDefinition,
        NodeExecutionLog,
        DeadLetterExecution,
    )
    DB_AVAILABLE = True
except ImportError:
    DB_AVAILABLE = False


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)

def _compute_duration_ms(started_at: datetime | None, finished_at: datetime | None) -> int | None:
    if not started_at or not finished_at:
        return None
    return int((finished_at - started_at).total_seconds() * 1000)

groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY", "mock"))

class DecisionCoreService:
    @staticmethod
    def evaluate_static_policy(financial_data: Dict[str, Any], policy_schema: Dict[str, Any]) -> Dict[str, Any]:
        """Runs the static recursive decision engine schema."""
        return evaluate_policy(financial_data=financial_data, policy_schema=policy_schema)

    @staticmethod
    def check_for_cycles(nodes: List[Any], edges: List[Any]) -> Optional[List[str]]:
        """
        Implements Kahn's Algorithm for Topological Sorting to detect cycles in a DAG.
        Returns None if valid DAG. Returns a list of Node IDs involved in cycle if loop is detected.
        """
        # Node ID abstraction allows handling dicts or objects
        in_degree = {node.get("id") if isinstance(node, dict) else node.id: 0 for node in nodes}
        graph = {node.get("id") if isinstance(node, dict) else node.id: [] for node in nodes}
        
        for edge in edges:
            source = edge.get("source") if isinstance(edge, dict) else edge.source
            target = edge.get("target") if isinstance(edge, dict) else edge.target
            if source in graph and target in in_degree:
                graph[source].append(target)
                in_degree[target] += 1
                
        queue = [node_id for node_id, degree in in_degree.items() if degree == 0]
        visited_count = 0
        
        while queue:
            current = queue.pop(0)
            visited_count += 1
            for neighbor in graph[current]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)
                    
        if visited_count != len(nodes):
            return [node_id for node_id, degree in in_degree.items() if degree > 0]
        return None

    @staticmethod
    def generate_ai_policy(prompt: str) -> Dict[str, Any]:
        """Wraps Groq LLaMA text-to-JSON policy generation via the prompt."""
        if not groq_client.api_key or groq_client.api_key == "mock":
             raise HTTPException(status_code=500, detail="GROQ_API_KEY environment variable is not configured.")

        system_prompt = f"""You are an expert Credit Risk Policy Architect.
Your ONLY job is to convert the user's natural language policy criteria into a strict, exact JSON object representing the credit policy rule schema.

CRITICAL RULES:
1. You MUST output ONLY raw, valid JSON.
2. Absolutely no markdown formatting (no ```json or ```).
3. Absolutely no conversational filler or explanations.
4. The JSON must EXACTLY match the following Pydantic schema structure:

{{
  "rules": [
    {{
      "id": "unique-node-id",
      "label": "Human readable label",
      "field": "dot.path.to.financial.field",
      "operator": "Must be exactly one of: {sorted(ALLOWED_OPERATORS)}",
      "value": 1.25,
      "on_true": {{
        "action": "decision or continue",
        "decision": "APPROVE or REJECT or MANUAL_REVIEW (only if action is decision)",
        "reason": "Explainability reason string",
        "next_rules": []
      }},
      "on_false": {{}}
    }}
  ],
  "default_decision": "MANUAL_REVIEW"
}}

Ensure the logic maps to realistic credit decisioning workflows. Handle both the happy path (Approval) and rejection paths gracefully based on the user's prompt."""

        try:
            completion = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_completion_tokens=2048,
                response_format={"type": "json_object"}
            )
            response_text = completion.choices[0].message.content.strip()

            try:
                parsed_json = json.loads(response_text)
            except json.JSONDecodeError as e:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, 
                    detail=f"AI generated invalid JSON syntax: {str(e)}"
                )

            try:
                validated_schema = PolicyRuleSchema.model_validate(parsed_json)
            except ValidationError as e:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, 
                    detail=f"AI hallucinated invalid schema structure: {e.errors()}"
                )

            return validated_schema.model_dump(by_alias=True)

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Groq API Error: {str(e)}")

    @staticmethod
    def persist_workflow_snapshot(payload_dict: dict[str, Any]) -> None:
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

    @staticmethod
    def seed_execution_run(execution_id: str, payload_dict: dict[str, Any], initial_input: dict[str, Any]) -> None:
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

    @staticmethod
    def persist_event(execution_id: str, workflow_id: str, event: dict[str, Any]) -> None:
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

            execution.updated_at = _utc_now()
            session.commit()

    @staticmethod
    def persist_dead_letter(execution_id: str, workflow_id: str, initial_input: dict[str, Any], error_message: str) -> None:
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

    @staticmethod
    async def emit_and_persist(execution_id: str, workflow_id: str, event: dict[str, Any]) -> None:
        if execution_event_broker:
            await execution_event_broker.publish(execution_id, event)
        if DB_AVAILABLE:
            persisted_event = dict(event)
            persisted_event.setdefault("timestamp", _utc_now().isoformat())
            await asyncio.to_thread(DecisionCoreService.persist_event, execution_id, workflow_id, persisted_event)

    @staticmethod
    async def run_workflow_execution(execution_id: str, payload_dict: dict[str, Any], initial_input: dict[str, Any]) -> None:
        if WorkflowEngine is None:
            return
        
        engine = WorkflowEngine(
            workflow_id=payload_dict["workflow_id"],
            nodes=payload_dict["nodes"],
            edges=payload_dict["edges"],
        )

        async def emit_event(event: dict[str, Any]) -> None:
            await DecisionCoreService.emit_and_persist(execution_id, payload_dict["workflow_id"], event)

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
                    DecisionCoreService.persist_dead_letter,
                    execution_id,
                    payload_dict["workflow_id"],
                    initial_input,
                    error_message,
                )
