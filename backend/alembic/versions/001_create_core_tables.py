"""001 – Create core tables (users, credit_policies, approval_requests, audit_logs)

Revision ID: 001_create_core_tables
Revises: None
Create Date: 2026-03-10
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001_create_core_tables"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Enum types (created once, reused across tables)
user_role_enum = postgresql.ENUM("MAKER", "CHECKER", "ADMIN", name="user_role_enum", create_type=False)
policy_status_enum = postgresql.ENUM("DRAFT", "ACTIVE", "ARCHIVED", name="policy_status_enum", create_type=False)
approval_status_enum = postgresql.ENUM("PENDING", "APPROVED", "REJECTED", name="approval_status_enum", create_type=False)


def upgrade() -> None:
    # Create enum types explicitly
    op.execute("CREATE TYPE user_role_enum AS ENUM ('MAKER', 'CHECKER', 'ADMIN')")
    op.execute("CREATE TYPE policy_status_enum AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED')")
    op.execute("CREATE TYPE approval_status_enum AS ENUM ('PENDING', 'APPROVED', 'REJECTED')")

    # ── users ──
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(320), unique=True, index=True, nullable=False),
        sa.Column("role", user_role_enum, nullable=False, server_default="MAKER"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── credit_policies ──
    op.create_table(
        "credit_policies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(256), nullable=False),
        sa.Column("rule_schema", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("status", policy_status_enum, nullable=False, server_default="DRAFT"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("name", "version", name="uq_policy_name_version"),
    )

    # ── approval_requests ──
    op.create_table(
        "approval_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("policy_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("credit_policies.id"), nullable=False),
        sa.Column("requested_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("status", approval_status_enum, nullable=False, server_default="PENDING"),
        sa.Column("comments", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── audit_logs ──
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("action", sa.String(128), nullable=False),
        sa.Column("entity_type", sa.String(128), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("payload", postgresql.JSONB, nullable=True, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("approval_requests")
    op.drop_table("credit_policies")
    op.drop_table("users")

    op.execute("DROP TYPE IF EXISTS approval_status_enum")
    op.execute("DROP TYPE IF EXISTS policy_status_enum")
    op.execute("DROP TYPE IF EXISTS user_role_enum")
