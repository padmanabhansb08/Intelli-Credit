from __future__ import annotations
"""
Async ORM Models (Parallel Infrastructure)
==========================================
Four core models built on AsyncBase.  This file does NOT import or touch
the existing db_models.py / database.py in any way.
"""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from async_database import AsyncBase


# ──────────────────────────────────────────────
# Enumerations
# ──────────────────────────────────────────────

class UserRole(str, enum.Enum):
    MAKER = "MAKER"
    CHECKER = "CHECKER"
    ADMIN = "ADMIN"


class PolicyStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_REVIEW = "PENDING_REVIEW"
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class ApprovalStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


# ──────────────────────────────────────────────
# Models
# ──────────────────────────────────────────────

class User(AsyncBase):
    """Platform user with role-based access control."""
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=_uuid,
    )
    email: Mapped[str] = mapped_column(
        String(320), unique=True, index=True, nullable=False,
    )
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="user_role_enum", create_constraint=True),
        nullable=False,
        default=UserRole.MAKER,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow,
    )

    # Relationships
    policies_created: Mapped[list["CreditPolicy"]] = relationship(
        back_populates="creator", lazy="selectin",
    )
    requests_made: Mapped[list["ApprovalRequest"]] = relationship(
        back_populates="requester",
        foreign_keys="[ApprovalRequest.requested_by]",
        lazy="selectin",
    )
    requests_approved: Mapped[list["ApprovalRequest"]] = relationship(
        back_populates="approver",
        foreign_keys="[ApprovalRequest.approved_by]",
        lazy="selectin",
    )
    audit_entries: Mapped[list["AuditLog"]] = relationship(
        back_populates="user", lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<User {self.email} [{self.role.value}]>"


class CreditPolicy(AsyncBase):
    """Versioned credit‑decision rule‑set stored as JSONB."""
    __tablename__ = "credit_policies"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=_uuid,
    )
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    rule_schema: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[PolicyStatus] = mapped_column(
        SAEnum(PolicyStatus, name="policy_status_enum", create_constraint=True),
        nullable=False,
        default=PolicyStatus.DRAFT,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow,
    )

    # Relationships
    creator: Mapped["User"] = relationship(back_populates="policies_created")
    approval_requests: Mapped[list["ApprovalRequest"]] = relationship(
        back_populates="policy", lazy="selectin",
    )

    __table_args__ = (
        UniqueConstraint("name", "version", name="uq_policy_name_version"),
    )

    def __repr__(self) -> str:
        return f"<CreditPolicy {self.name} v{self.version} [{self.status.value}]>"


class ApprovalRequest(AsyncBase):
    """Maker‑Checker approval workflow record."""
    __tablename__ = "approval_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=_uuid,
    )
    policy_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("credit_policies.id"), nullable=False,
    )
    requested_by: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False,
    )
    approved_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True,
    )
    status: Mapped[ApprovalStatus] = mapped_column(
        SAEnum(ApprovalStatus, name="approval_status_enum", create_constraint=True),
        nullable=False,
        default=ApprovalStatus.PENDING,
    )
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow,
    )

    # Relationships
    policy: Mapped["CreditPolicy"] = relationship(back_populates="approval_requests")
    requester: Mapped["User"] = relationship(
        back_populates="requests_made",
        foreign_keys=[requested_by],
    )
    approver: Mapped["User"] = relationship(
        back_populates="requests_approved",
        foreign_keys=[approved_by],
    )

    def __repr__(self) -> str:
        return f"<ApprovalRequest {self.id} [{self.status.value}]>"


class AuditLog(AsyncBase):
    """Immutable, append‑only audit trail for regulatory compliance."""
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=_uuid,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False,
    )
    action: Mapped[str] = mapped_column(String(128), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(128), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), nullable=False,
    )
    payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow,
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="audit_entries")

    def __repr__(self) -> str:
        return f"<AuditLog {self.action} on {self.entity_type}/{self.entity_id}>"


# --- Migrated from db_models.py ---


from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON




def _utcnow() -> datetime:
    return datetime.utcnow()


class WorkflowDefinition(AsyncBase):
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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)
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


class WorkflowNodeDefinition(AsyncBase):
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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)

    workflow: Mapped["WorkflowDefinition"] = relationship("WorkflowDefinition", back_populates="nodes")


class WorkflowEdgeDefinition(AsyncBase):
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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)

    workflow: Mapped["WorkflowDefinition"] = relationship("WorkflowDefinition", back_populates="edges")


class CredentialRecord(AsyncBase):
    __tablename__ = "credential_records"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    provider: Mapped[str] = mapped_column(String(128))
    auth_type: Mapped[str] = mapped_column(String(64), default="api_key")
    encrypted_secret: Mapped[bytes] = mapped_column(LargeBinary)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)


class ExecutionRun(AsyncBase):
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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)

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


class NodeExecutionLog(AsyncBase):
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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    execution: Mapped["ExecutionRun"] = relationship("ExecutionRun", back_populates="node_logs")


class DeadLetterExecution(AsyncBase):
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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    execution: Mapped["ExecutionRun"] = relationship("ExecutionRun", back_populates="dead_letter")


class BorrowerEntity(AsyncBase):
    __tablename__ = "borrower_entities"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    industry: Mapped[str | None] = mapped_column(String(128), nullable=True)
    constitution: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)

    applications: Mapped[list["CreditApplication"]] = relationship(
        "CreditApplication",
        back_populates="borrower",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class CreditApplication(AsyncBase):
    __tablename__ = "credit_applications"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    borrower_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("borrower_entities.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(String(64), default="INITIATED")
    facility_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    currency: Mapped[str] = mapped_column(String(16), default="INR")
    purpose: Mapped[str | None] = mapped_column(Text, nullable=True)
    term_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    recommended_limit: Mapped[float | None] = mapped_column(Float, nullable=True)
    decision: Mapped[str | None] = mapped_column(String(64), nullable=True)
    grade: Mapped[str | None] = mapped_column(String(16), nullable=True)
    composite_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    dscr_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)
    leverage_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)
    gstr_mismatch_flag: Mapped[bool | None] = mapped_column(Boolean, nullable=True, default=False)
    nclt_flag: Mapped[bool | None] = mapped_column(Boolean, nullable=True, default=False)
    pd_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)

    borrower: Mapped["BorrowerEntity"] = relationship("BorrowerEntity", back_populates="applications")
    audit_log: Mapped["ImmutableAuditLog | None"] = relationship(
        "ImmutableAuditLog",
        back_populates="application",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )


class ImmutableAuditLog(AsyncBase):
    __tablename__ = "immutable_audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    application_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("credit_applications.id", ondelete="CASCADE"), unique=True, index=True
    )
    exact_timestamp: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    input_payload_json: Mapped[dict[str, Any]] = mapped_column(JSON)
    ruleset_json: Mapped[dict[str, Any]] = mapped_column(JSON)
    deterministic_outcome_json: Mapped[dict[str, Any]] = mapped_column(JSON)

    application: Mapped["CreditApplication"] = relationship("CreditApplication", back_populates="audit_log")


class CreditRecord(AsyncBase):
    __tablename__ = "credit_records"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    application_id: Mapped[str] = mapped_column(String(128), ForeignKey("credit_applications.id", ondelete="CASCADE"), index=True)
    company_name: Mapped[str] = mapped_column(String(255), index=True)
    industry: Mapped[str | None] = mapped_column(String(128), nullable=True)
    
    # 5 Cs Summaries and Scores
    character_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    capacity_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    capital_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    collateral_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    conditions_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    
    character_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    capacity_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    capital_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    collateral_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    conditions_summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Financial Metrics
    revenue: Mapped[float | None] = mapped_column(Float, nullable=True)
    ebitda: Mapped[float | None] = mapped_column(Float, nullable=True)
    debt_service_coverage_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)
    
    # Outputs
    composite_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(64), default="COMPLETED")
    
    # Textual details for vector matching
    full_text_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)

    application: Mapped["CreditApplication"] = relationship("CreditApplication", backref="credit_record")



class AnalysisSession(AsyncBase):
    __tablename__ = 'analysis_sessions'

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(64), default='INITIATED')
    draft_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    raw_extracts: Mapped[dict] = mapped_column(JSONB, default=dict)
    full_result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    def __repr__(self) -> str:
        return f'<AnalysisSession {self.id} [{self.status}]>'
