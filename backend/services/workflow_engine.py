from __future__ import annotations

import asyncio
import json
from collections import defaultdict, deque
from copy import deepcopy
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Iterable

from utils.expression_evaluator import (
    ExpressionEvaluationError,
    evaluate_condition,
    render_template,
)


EventCallback = Callable[[dict[str, Any]], Awaitable[None]]


@dataclass(slots=True)
class NodeDefinition:
    id: str
    type: str
    position: dict[str, float]
    data: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class EdgeDefinition:
    id: str
    source: str
    target: str
    source_handle: str | None = None
    target_handle: str | None = None
    edge_type: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ExecutionPacket:
    edge_id: str
    source_node_id: str
    source_handle: str | None
    output: Any


@dataclass(slots=True)
class NodeRunResult:
    output: Any
    active_handles: set[str | None]
    status: str = "success"
    error_message: str | None = None
    duration_ms: int | None = None
    attempts: int = 1


class WorkflowEngineError(RuntimeError):
    pass


class WorkflowEngine:
    COST_MAP = {
        "triggerNode": 1,
        "integrationNode": 5,
        "conditionNode": 2,
        "documentClassificationNode": 18,
        "explainableAINode": 12,
        "iteratorNode": 4,
        "aggregatorNode": 4,
    }

    def __init__(self, workflow_id: str, nodes: Iterable[dict[str, Any]], edges: Iterable[dict[str, Any]]) -> None:
        self.workflow_id = workflow_id
        self.nodes = [self._hydrate_node(node) for node in nodes]
        self.edges = [self._hydrate_edge(edge) for edge in edges]
        self.nodes_by_id = {node.id: node for node in self.nodes}
        self.outgoing_edges: dict[str, list[EdgeDefinition]] = defaultdict(list)
        self.incoming_edges: dict[str, list[EdgeDefinition]] = defaultdict(list)
        self.edge_state: dict[str, dict[str, Any]] = {}
        self.node_outputs: dict[str, Any] = {}
        self.node_status: dict[str, str] = {}
        self.tokens_consumed = 0
        self._queued: set[str] = set()

        for edge in self.edges:
            if edge.source not in self.nodes_by_id or edge.target not in self.nodes_by_id:
                continue
            self.outgoing_edges[edge.source].append(edge)
            self.incoming_edges[edge.target].append(edge)
            self.edge_state[edge.id] = {"status": "pending", "packet": None, "reason": None}

    @staticmethod
    def _hydrate_node(payload: dict[str, Any]) -> NodeDefinition:
        return NodeDefinition(
            id=payload["id"],
            type=payload["type"],
            position=payload.get("position") or {"x": 0, "y": 0},
            data=deepcopy(payload.get("data") or {}),
        )

    @staticmethod
    def _hydrate_edge(payload: dict[str, Any]) -> EdgeDefinition:
        metadata = deepcopy(payload)
        metadata.pop("id", None)
        metadata.pop("source", None)
        metadata.pop("target", None)
        metadata.pop("sourceHandle", None)
        metadata.pop("targetHandle", None)
        metadata.pop("type", None)
        return EdgeDefinition(
            id=payload["id"],
            source=payload["source"],
            target=payload["target"],
            source_handle=payload.get("sourceHandle"),
            target_handle=payload.get("targetHandle"),
            edge_type=payload.get("type"),
            metadata=metadata,
        )

    def estimate_cost(self) -> dict[str, Any]:
        total_credits = 0
        breakdown: list[dict[str, Any]] = []
        for node in self.nodes:
            cost = self.COST_MAP.get(node.type, 1)
            total_credits += cost
            breakdown.append(
                {
                    "node_id": node.id,
                    "label": node.data.get("label") or node.id,
                    "cost": cost,
                }
            )
        return {
            "total_credits": total_credits,
            "currency_equivalent": round(total_credits * 0.04, 2),
            "breakdown": breakdown,
        }

    async def run(
        self,
        *,
        execution_id: str,
        initial_input: dict[str, Any],
        emit_event: EventCallback,
    ) -> dict[str, Any]:
        self.node_outputs.clear()
        self.node_status = {node.id: "pending" for node in self.nodes}
        self.tokens_consumed = 0
        self._queued.clear()
        for edge_id in self.edge_state:
            self.edge_state[edge_id] = {"status": "pending", "packet": None, "reason": None}

        queue: deque[str] = deque()
        for node_id in self._find_start_nodes():
            self._enqueue(queue, node_id)

        await emit_event(
            {
                "type": "execution.started",
                "workflow_id": self.workflow_id,
                "status": "running",
                "message": "Workflow execution started.",
                "initial_input": initial_input,
            }
        )

        while queue:
            node_id = queue.popleft()
            self._queued.discard(node_id)
            node = self.nodes_by_id[node_id]
            if self.node_status[node_id] != "pending":
                continue

            active_packets = self._active_packets(node_id)
            if self._should_skip_node(node_id):
                await self._skip_node(node_id, "No active inbound path was resolved for this node.", emit_event)
                self._schedule_downstream(node_id, queue)
                continue

            result = await self._execute_node_with_retries(
                execution_id=execution_id,
                node=node,
                initial_input=initial_input,
                active_packets=active_packets,
                emit_event=emit_event,
            )

            self.node_outputs[node_id] = result.output
            self.node_status[node_id] = result.status
            self._resolve_outgoing_edges(node, result)
            self._schedule_downstream(node_id, queue)

            if result.status == "failed" and "error" not in result.active_handles:
                raise WorkflowEngineError(result.error_message or f"Node {node.id} failed.")

        self._finalize_unreached_nodes()

        final_state = {
            "initial_input": initial_input,
            "node_outputs": deepcopy(self.node_outputs),
            "node_status": deepcopy(self.node_status),
        }

        await emit_event(
            {
                "type": "execution.completed",
                "workflow_id": self.workflow_id,
                "status": "success",
                "message": "Workflow execution completed.",
                "final_state": final_state,
                "tokens_consumed": self.tokens_consumed,
            }
        )

        return {
            "workflow_id": self.workflow_id,
            "tokens_consumed": self.tokens_consumed,
            "final_state": final_state,
        }

    def _find_start_nodes(self) -> list[str]:
        trigger_nodes = [node.id for node in self.nodes if node.type == "triggerNode"]
        if trigger_nodes:
            return trigger_nodes
        return [node.id for node in self.nodes if not self.incoming_edges.get(node.id)]

    def _enqueue(self, queue: deque[str], node_id: str) -> None:
        if node_id in self._queued or self.node_status.get(node_id) != "pending":
            return
        self._queued.add(node_id)
        queue.append(node_id)

    def _active_packets(self, node_id: str) -> list[ExecutionPacket]:
        packets: list[ExecutionPacket] = []
        for edge in self.incoming_edges.get(node_id, []):
            state = self.edge_state.get(edge.id, {})
            if state.get("status") == "active" and state.get("packet") is not None:
                packets.append(state["packet"])
        return packets

    def _should_skip_node(self, node_id: str) -> bool:
        incoming = self.incoming_edges.get(node_id, [])
        if not incoming:
            return False
        states = [self.edge_state[edge.id]["status"] for edge in incoming]
        if any(status == "pending" for status in states):
            return False
        return all(status == "skipped" for status in states)

    async def _skip_node(self, node_id: str, reason: str, emit_event: EventCallback) -> None:
        self.node_status[node_id] = "skipped"
        node = self.nodes_by_id[node_id]
        for edge in self.outgoing_edges.get(node_id, []):
            self.edge_state[edge.id] = {"status": "skipped", "packet": None, "reason": reason}
        await emit_event(
            {
                "type": "node.skipped",
                "workflow_id": self.workflow_id,
                "node_id": node_id,
                "node_type": node.type,
                "status": "skipped",
                "message": reason,
            }
        )

    def _schedule_downstream(self, node_id: str, queue: deque[str]) -> None:
        for edge in self.outgoing_edges.get(node_id, []):
            target_id = edge.target
            if self.node_status.get(target_id) != "pending":
                continue
            target_edges = self.incoming_edges.get(target_id, [])
            if not target_edges:
                self._enqueue(queue, target_id)
                continue
            target_states = [self.edge_state[target_edge.id]["status"] for target_edge in target_edges]
            if any(status == "pending" for status in target_states):
                continue
            self._enqueue(queue, target_id)

    def _finalize_unreached_nodes(self) -> None:
        for node in self.nodes:
            if self.node_status.get(node.id) == "pending":
                self.node_status[node.id] = "skipped"

    def _resolve_outgoing_edges(self, node: NodeDefinition, result: NodeRunResult) -> None:
        active_handles = result.active_handles or {None}
        outgoing = self.outgoing_edges.get(node.id, [])
        for edge in outgoing:
            if self._edge_is_active(node.type, edge.source_handle, active_handles):
                self.edge_state[edge.id] = {
                    "status": "active",
                    "packet": ExecutionPacket(
                        edge_id=edge.id,
                        source_node_id=node.id,
                        source_handle=edge.source_handle,
                        output=deepcopy(result.output),
                    ),
                    "reason": None,
                }
            else:
                self.edge_state[edge.id] = {
                    "status": "skipped",
                    "packet": None,
                    "reason": f"Branch {edge.source_handle or 'default'} was not selected.",
                }

    @staticmethod
    def _edge_is_active(
        node_type: str,
        edge_source_handle: str | None,
        active_handles: set[str | None],
    ) -> bool:
        if node_type == "conditionNode":
            if edge_source_handle is None:
                return "true" in active_handles
            return edge_source_handle in active_handles
        if "error" in active_handles:
            return edge_source_handle == "error"
        if edge_source_handle in (None, "", "success"):
            return True
        return edge_source_handle in active_handles

    async def _execute_node_with_retries(
        self,
        *,
        execution_id: str,
        node: NodeDefinition,
        initial_input: dict[str, Any],
        active_packets: list[ExecutionPacket],
        emit_event: EventCallback,
    ) -> NodeRunResult:
        execution_config = deepcopy(node.data.get("executionConfig") or {})
        max_retries = int(execution_config.get("maxRetries", 0) or 0)
        retry_delay_ms = int(execution_config.get("retryDelay", 0) or 0)
        backoff_multiplier = float(execution_config.get("backoffMultiplier", 2) or 2)
        continue_on_fail = bool(execution_config.get("continueOnFail", False))
        last_error: Exception | None = None

        for attempt in range(1, max_retries + 2):
            started_at = datetime.now(timezone.utc)
            input_payload = self._build_input_payload(active_packets)
            context = self._build_runtime_context(
                execution_id=execution_id,
                node=node,
                initial_input=initial_input,
                active_packets=active_packets,
                input_payload=input_payload,
                attempt=attempt,
            )
            await emit_event(
                {
                    "type": "node.started",
                    "workflow_id": self.workflow_id,
                    "node_id": node.id,
                    "node_type": node.type,
                    "status": "running",
                    "attempt": attempt,
                    "input": input_payload,
                    "message": f"Executing {node.data.get('label') or node.id}.",
                    "started_at": started_at.isoformat(),
                }
            )
            try:
                self.tokens_consumed += self.COST_MAP.get(node.type, 1)
                output, active_handles = await self._execute_node(node, context)
                finished_at = datetime.now(timezone.utc)
                return_result = NodeRunResult(
                    output=output,
                    active_handles=active_handles,
                    status="success",
                    duration_ms=int((finished_at - started_at).total_seconds() * 1000),
                    attempts=attempt,
                )
                await emit_event(
                    {
                        "type": "node.completed",
                        "workflow_id": self.workflow_id,
                        "node_id": node.id,
                        "node_type": node.type,
                        "status": "success",
                        "attempt": attempt,
                        "input": input_payload,
                        "output": output,
                        "active_handles": list(active_handles),
                        "message": f"{node.data.get('label') or node.id} completed.",
                        "started_at": started_at.isoformat(),
                        "finished_at": finished_at.isoformat(),
                        "duration_ms": return_result.duration_ms,
                    }
                )
                return return_result
            except Exception as exc:
                last_error = exc
                finished_at = datetime.now(timezone.utc)
                duration_ms = int((finished_at - started_at).total_seconds() * 1000)
                if attempt <= max_retries:
                    await emit_event(
                        {
                            "type": "node.retry_scheduled",
                            "workflow_id": self.workflow_id,
                            "node_id": node.id,
                            "node_type": node.type,
                            "status": "retrying",
                            "attempt": attempt,
                            "error": str(exc),
                            "message": f"{node.data.get('label') or node.id} failed. Retrying attempt {attempt + 1}.",
                            "started_at": started_at.isoformat(),
                            "finished_at": finished_at.isoformat(),
                            "duration_ms": duration_ms,
                        }
                    )
                    if retry_delay_ms > 0:
                        await asyncio.sleep((retry_delay_ms / 1000) * (backoff_multiplier ** (attempt - 1)))
                    continue

                error_message = str(exc)
                failure_output = {
                    "error": error_message,
                    "nodeId": node.id,
                    "nodeType": node.type,
                }
                active_handles = {"error"} if continue_on_fail else set()
                status = "failed"
                await emit_event(
                    {
                        "type": "node.failed",
                        "workflow_id": self.workflow_id,
                        "node_id": node.id,
                        "node_type": node.type,
                        "status": status,
                        "attempt": attempt,
                        "input": input_payload,
                        "output": failure_output if continue_on_fail else None,
                        "error": error_message,
                        "active_handles": list(active_handles),
                        "message": error_message,
                        "started_at": started_at.isoformat(),
                        "finished_at": finished_at.isoformat(),
                        "duration_ms": duration_ms,
                    }
                )
                if continue_on_fail:
                    return NodeRunResult(
                        output=failure_output,
                        active_handles=active_handles,
                        status=status,
                        error_message=error_message,
                        duration_ms=duration_ms,
                        attempts=attempt,
                    )
                raise WorkflowEngineError(error_message) from exc

        raise WorkflowEngineError(str(last_error) if last_error else "Unknown workflow failure")

    def _build_runtime_context(
        self,
        *,
        execution_id: str,
        node: NodeDefinition,
        initial_input: dict[str, Any],
        active_packets: list[ExecutionPacket],
        input_payload: dict[str, Any],
        attempt: int,
    ) -> dict[str, Any]:
        parents = {packet.source_node_id: deepcopy(packet.output) for packet in active_packets}
        nodes_context = {}
        for node_id, output in self.node_outputs.items():
            nodes_context[node_id] = deepcopy(output)
            nodes_context[self._sanitize_identifier(node_id)] = deepcopy(output)
        return {
            "input": deepcopy(initial_input),
            "nodes": nodes_context,
            "steps": nodes_context,
            "parents": parents,
            "current": {
                "node": {
                    "id": node.id,
                    "type": node.type,
                    "label": node.data.get("label"),
                },
                "input": deepcopy(input_payload),
            },
            "meta": {
                "execution_id": execution_id,
                "workflow_id": self.workflow_id,
                "attempt": attempt,
            },
        }

    def _build_input_payload(self, active_packets: list[ExecutionPacket]) -> dict[str, Any]:
        if not active_packets:
            return {}
        merged: dict[str, Any] = {}
        for packet in active_packets:
            packet_output = packet.output
            if isinstance(packet_output, dict):
                merged = self._deep_merge_json(merged, deepcopy(packet_output))
            else:
                merged[packet.source_node_id] = deepcopy(packet_output)
        return merged

    def _deep_merge_json(self, left: dict[str, Any], right: dict[str, Any]) -> dict[str, Any]:
        merged = deepcopy(left)
        for key, value in right.items():
            if key not in merged:
                merged[key] = value
                continue
            existing = merged[key]
            if isinstance(existing, dict) and isinstance(value, dict):
                merged[key] = self._deep_merge_json(existing, value)
                continue
            if existing == value:
                merged[key] = value
                continue
            if isinstance(existing, list):
                merged[key] = existing + [value]
            else:
                merged[key] = [existing, value]
        return merged

    async def _execute_node(self, node: NodeDefinition, context: dict[str, Any]) -> tuple[Any, set[str | None]]:
        if node.type == "triggerNode":
            payload = deepcopy(context["input"])
            payload["trigger"] = {
                "type": node.data.get("triggerType", "manual"),
                "label": node.data.get("label"),
            }
            return payload, {None}

        if node.type == "documentClassificationNode":
            extracted_fields = deepcopy(node.data.get("extractedFields") or [])
            fields_map = {
                self._sanitize_identifier(item.get("key", f"field_{index}")): item.get("value")
                for index, item in enumerate(extracted_fields)
            }
            output = {
                "label": node.data.get("label"),
                "confidence": node.data.get("confidence"),
                "extractedFields": extracted_fields,
                "fields": fields_map,
            }
            return output, {None}

        if node.type == "integrationNode":
            input_mapping = node.data.get("inputMapping") or node.data.get("requestBody") or context["current"]["input"]
            rendered_request = render_template(input_mapping, context)
            mock_response = node.data.get("mockResponse") or {
                "status": "connected",
                "source": node.data.get("connection") or "External API",
                "requestEcho": rendered_request,
                "score": 740,
            }
            response_context = deepcopy(context)
            response_context["request"] = rendered_request
            response_context["response"] = mock_response
            rendered_response = render_template(mock_response, response_context)
            output_mapping = node.data.get("outputMapping")
            if output_mapping:
                response_context["response"] = rendered_response
                mapped_output = render_template(output_mapping, response_context)
            else:
                mapped_output = {
                    "connection": node.data.get("connection") or "External API",
                    "request": rendered_request,
                    "response": rendered_response,
                    "credentialRef": node.data.get("credentialId"),
                }
            return mapped_output, {None}

        if node.type == "conditionNode":
            evaluation_result = self._evaluate_condition_node(node, context)
            branch = "true" if evaluation_result else "false"
            output = {
                "result": evaluation_result,
                "branch": branch,
                "targetField": node.data.get("targetField"),
                "defaultValue": node.data.get("defaultValue"),
            }
            return output, {branch}

        if node.type == "explainableAINode":
            shap_values = deepcopy(node.data.get("shapValues") or [])
            output = {
                "shapValues": shap_values,
                "summary": self._summarize_shap_values(shap_values),
            }
            return output, {None}

        if node.type == "aggregatorNode":
            output = {
                "items": [deepcopy(value) for value in context.get("parents", {}).values()],
                "count": len(context.get("parents", {})),
            }
            return output, {None}

        if node.type == "iteratorNode":
            iterable = render_template(node.data.get("iterateOn") or [], context)
            if not isinstance(iterable, list):
                raise WorkflowEngineError("Iterator nodes require an array input.")
            return {"items": iterable, "count": len(iterable)}, {None}

        return deepcopy(context["current"]["input"]), {None}

    def _evaluate_condition_node(self, node: NodeDefinition, context: dict[str, Any]) -> bool:
        rules = node.data.get("rules") or []
        if rules:
            combinator = str(node.data.get("ruleCombinator", "and")).lower()
            results = [self._evaluate_rule(rule, context) for rule in rules]
            return all(results) if combinator != "or" else any(results)

        expression = (
            node.data.get("expression")
            or node.data.get("conditionExpression")
            or node.data.get("assignmentDetails")
            or "False"
        )
        try:
            return evaluate_condition(expression, context)
        except ExpressionEvaluationError as exc:
            raise WorkflowEngineError(f"Condition node {node.id} has an invalid expression.") from exc

    def _evaluate_rule(self, rule: dict[str, Any], context: dict[str, Any]) -> bool:
        left = render_template(rule.get("left"), context)
        right = render_template(rule.get("right"), context)
        operator_name = str(rule.get("operator", "eq")).lower()

        if operator_name in {"eq", "equals"}:
            return left == right
        if operator_name in {"ne", "not_equals"}:
            return left != right
        if operator_name in {"gt", "greater_than"}:
            return left > right
        if operator_name in {"gte", "greater_than_or_equal"}:
            return left >= right
        if operator_name in {"lt", "less_than"}:
            return left < right
        if operator_name in {"lte", "less_than_or_equal"}:
            return left <= right
        if operator_name == "contains":
            return right in left
        if operator_name == "in":
            return left in right
        if operator_name == "truthy":
            return bool(left)
        if operator_name == "falsy":
            return not bool(left)
        raise WorkflowEngineError(f"Unsupported rule operator: {operator_name}")

    @staticmethod
    def _summarize_shap_values(shap_values: list[dict[str, Any]]) -> str:
        if not shap_values:
            return "No feature attributions available."
        strongest = max(shap_values, key=lambda item: abs(float(item.get("impact", 0))))
        return f"{strongest.get('name')} had the highest impact at {strongest.get('impact')}."

    @staticmethod
    def _sanitize_identifier(value: str) -> str:
        return "".join(character if character.isalnum() or character == "_" else "_" for character in value)

    @staticmethod
    def preview_json(value: Any) -> str:
        try:
            rendered = json.dumps(value, default=str)
        except TypeError:
            rendered = str(value)
        return rendered if len(rendered) <= 240 else f"{rendered[:237]}..."

