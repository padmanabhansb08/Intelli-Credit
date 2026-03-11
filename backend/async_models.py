"""
Async ORM Models (Parallel Infrastructure)
==========================================
Four core models built on AsyncBase.  This file does NOT import or touch
the existing db_models.py / database.py in any way.
"""
from __future__ import annotations

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
