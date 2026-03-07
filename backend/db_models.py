from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Float, ForeignKey, Integer, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from database import Base


def utc_now() -> datetime:
    return datetime.utcnow()


class WorkflowDefinition(Base):
    __tablename__ = "workflow_definitions"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), default="Untitled Workflow")
    status: Mapped[str] = mapped_column(String(32), default="draft")
    version: Mapped[int] = mapped_column(Integer, default=1)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    trigger_type: Mapped[str] = mapped_column(String(64), default="manual")
    webhook_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cron_expression: Mapped[str | None] = mapped_column(String(255), nullable=True)
    definition_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    graph_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    nodes: Mapped[list["WorkflowNodeDefinition"]] = relationship(
        "WorkflowNodeDefinition",
        back_populates="workflow",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    edges: Mapped[list["WorkflowEdgeDefinition"]] = relationship(
        "WorkflowEdgeDefinition",
        back_populates="workflow",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    executions: Mapped[list["ExecutionRun"]] = relationship(
        "ExecutionRun",
        back_populates="workflow",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class WorkflowNodeDefinition(Base):
    __tablename__ = "workflow_node_definitions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workflow_id: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("workflow_definitions.id", ondelete="CASCADE"),
        index=True,
    )
    node_id: Mapped[str] = mapped_column(String(128), index=True)
    node_type: Mapped[str] = mapped_column(String(64))
    label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    position_x: Mapped[float] = mapped_column(Float, default=0)
    position_y: Mapped[float] = mapped_column(Float, default=0)
    config_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    execution_config_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)

    workflow: Mapped["WorkflowDefinition"] = relationship("WorkflowDefinition", back_populates="nodes")


class WorkflowEdgeDefinition(Base):
    __tablename__ = "workflow_edge_definitions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workflow_id: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("workflow_definitions.id", ondelete="CASCADE"),
        index=True,
    )
    edge_id: Mapped[str] = mapped_column(String(128), index=True)
    source_node_id: Mapped[str] = mapped_column(String(128), index=True)
    target_node_id: Mapped[str] = mapped_column(String(128), index=True)
    source_handle: Mapped[str | None] = mapped_column(String(64), nullable=True)
    target_handle: Mapped[str | None] = mapped_column(String(64), nullable=True)
    edge_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    config_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)

    workflow: Mapped["WorkflowDefinition"] = relationship("WorkflowDefinition", back_populates="edges")


class CredentialRecord(Base):
    __tablename__ = "credential_records"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    provider: Mapped[str] = mapped_column(String(128))
    auth_type: Mapped[str] = mapped_column(String(64), default="api_key")
    encrypted_secret: Mapped[bytes] = mapped_column(LargeBinary)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)


class ExecutionRun(Base):
    __tablename__ = "execution_runs"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    workflow_id: Mapped[str | None] = mapped_column(
        String(128),
        ForeignKey("workflow_definitions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    workflow_version: Mapped[int] = mapped_column(Integer, default=1)
    trigger_type: Mapped[str] = mapped_column(String(64), default="manual")
    status: Mapped[str] = mapped_column(String(32), default="queued")
    initiated_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    initial_payload_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    final_payload_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    tokens_consumed: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)

    workflow: Mapped["WorkflowDefinition | None"] = relationship("WorkflowDefinition", back_populates="executions")
    node_logs: Mapped[list["NodeExecutionLog"]] = relationship(
        "NodeExecutionLog",
        back_populates="execution",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    dead_letter: Mapped["DeadLetterExecution | None"] = relationship(
        "DeadLetterExecution",
        back_populates="execution",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )


class NodeExecutionLog(Base):
    __tablename__ = "node_execution_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    execution_id: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("execution_runs.id", ondelete="CASCADE"),
        index=True,
    )
    workflow_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    node_id: Mapped[str] = mapped_column(String(128), index=True)
    node_type: Mapped[str] = mapped_column(String(64))
    event_type: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32))
    attempt: Mapped[int] = mapped_column(Integer, default=1)
    input_payload_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    output_payload_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    source_edges_json: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    execution: Mapped["ExecutionRun"] = relationship("ExecutionRun", back_populates="node_logs")


class DeadLetterExecution(Base):
    __tablename__ = "dead_letter_executions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    execution_id: Mapped[str] = mapped_column(
        String(128),
        ForeignKey("execution_runs.id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )
    workflow_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    failure_stage: Mapped[str] = mapped_column(String(64), default="workflow")
    reason: Mapped[str] = mapped_column(Text)
    payload_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    execution: Mapped["ExecutionRun"] = relationship("ExecutionRun", back_populates="dead_letter")

