"""
Pydantic Validation Schemas for Policy Engine & Decision Endpoints
===================================================================
Enforces strict validation on credit policy rule schemas and decision requests.
Payloads lacking required fields (node_id, operator, etc.) are rejected with 422.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


# ── Enums ────────────────────────────────────────────────────────────────────

class PolicyStatusEnum(str, Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class SortOrder(str, Enum):
    asc = "asc"
    desc = "desc"


class PolicySortField(str, Enum):
    name = "name"
    version = "version"
    status = "status"
    created_at = "created_at"
    updated_at = "updated_at"


# ── Rule Schema Validation (Recursive) ──────────────────────────────────────

ALLOWED_OPERATORS = {">", ">=", "<", "<=", "==", "!=", "in", "not_in", "between",
                     "gt", "gte", "lt", "lte", "eq", "ne"}


class RuleBranch(BaseModel):
    """Branch target for on_true / on_false."""
    action: str = Field(..., description="'decision' or 'continue'")
    decision: Optional[str] = Field(None, description="Terminal decision string")
    reason: Optional[str] = Field(None, description="Explainability reason")
    next_rules: Optional[list["RuleNode"]] = Field(None, description="Recursive child rules")


class RuleNode(BaseModel):
    """A single node in the credit policy rule tree."""
    node_id: str = Field(..., alias="id", min_length=1, description="Unique rule identifier (REQUIRED)")
    label: str = Field(..., min_length=1, description="Human-readable label")
    field: str = Field(..., min_length=1, description="Dot-path to the financial data field")
    operator: str = Field(..., description="Comparison operator")
    value: Any = Field(..., description="Threshold or comparison value")
    on_true: Optional[RuleBranch] = None
    on_false: Optional[RuleBranch] = None

    model_config = {"populate_by_name": True}

    @field_validator("operator")
    @classmethod
    def validate_operator(cls, v: str) -> str:
        if v not in ALLOWED_OPERATORS:
            raise ValueError(f"Unsupported operator '{v}'. Must be one of: {sorted(ALLOWED_OPERATORS)}")
        return v


# Rebuild forward references for recursive model
RuleBranch.model_rebuild()
RuleNode.model_rebuild()


class PolicyRuleSchema(BaseModel):
    """Top-level policy rule schema stored in CreditPolicy.rule_schema (JSONB)."""
    rules: list[RuleNode] = Field(..., min_length=1, description="At least one rule is required")
    default_decision: str = Field("MANUAL_REVIEW", description="Fallback decision when no terminal node is reached")


# ── Request / Response Models ────────────────────────────────────────────────

class PolicyCreateRequest(BaseModel):
    """POST /policies — create a new draft policy."""
    name: str = Field(..., min_length=1, max_length=256)
    rule_schema: PolicyRuleSchema


class PolicyUpdateRequest(BaseModel):
    """PUT /policies/{id} — update an existing policy."""
    name: Optional[str] = Field(None, min_length=1, max_length=256)
    rule_schema: Optional[PolicyRuleSchema] = None
    status: Optional[PolicyStatusEnum] = None


class PolicyResponse(BaseModel):
    """Standard policy response."""
    id: uuid.UUID
    name: str
    rule_schema: dict
    version: int
    status: PolicyStatusEnum
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaginatedPolicyResponse(BaseModel):
    """GET /policies — paginated list."""
    items: list[PolicyResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ── Decision Models ──────────────────────────────────────────────────────────

class DecisionEvaluateRequest(BaseModel):
    """POST /decisions/evaluate — evaluate loan application data against a policy."""
    policy_id: uuid.UUID = Field(..., description="UUID of the CreditPolicy to evaluate against")
    financial_data: dict = Field(..., description="LLM-extracted financial metrics JSON")


class DecisionEvaluateResponse(BaseModel):
    """Response from the decision evaluation endpoint."""
    decision: str
    reason: str
    execution_trail: list[dict]
    nodes_triggered: list[str]
    policy_id: uuid.UUID
    idempotency_key: Optional[str] = None
