"""
Policies Router — RESTful CRUD for CreditPolicy
=================================================
GET  /policies            → paginated, sortable list
POST /policies            → create new DRAFT policy
PUT  /policies/{id}       → update existing policy

All payloads are validated by schemas_v2 — missing node_id or operator → 422.
"""
from __future__ import annotations

import math
import uuid
import json
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from groq import Groq

from async_database import get_async_db
from async_models import CreditPolicy, PolicyStatus
from schemas_v2 import (
    PolicyCreateRequest,
    PolicyUpdateRequest,
    PolicyResponse,
    PaginatedPolicyResponse,
    PolicySortField,
    PolicyStatusEnum,
    SortOrder,
    PolicyRuleSchema,
    ALLOWED_OPERATORS,
)

router = APIRouter()

groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY", ""))

# ── Placeholder user ID (wired to Firebase in production) ────────────────────
_SYSTEM_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


# ── GET /policies ────────────────────────────────────────────────────────────

@router.get(
    "/policies",
    response_model=PaginatedPolicyResponse,
    status_code=status.HTTP_200_OK,
    summary="List credit policies with pagination & sorting",
)
async def list_policies(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    sort_by: PolicySortField = Query(PolicySortField.created_at, description="Sort column"),
    sort_order: SortOrder = Query(SortOrder.desc, description="Sort direction"),
    status_filter: Optional[PolicyStatusEnum] = Query(None, alias="status", description="Filter by status"),
    db: AsyncSession = Depends(get_async_db),
):
    # Base query
    query = select(CreditPolicy)
    count_query = select(func.count()).select_from(CreditPolicy)

    # Optional status filter
    if status_filter is not None:
        pg_status = PolicyStatus(status_filter.value)
        query = query.where(CreditPolicy.status == pg_status)
        count_query = count_query.where(CreditPolicy.status == pg_status)

    # Sorting
    sort_col = getattr(CreditPolicy, sort_by.value, CreditPolicy.created_at)
    if sort_order == SortOrder.desc:
        query = query.order_by(sort_col.desc())
    else:
        query = query.order_by(sort_col.asc())

    # Total count
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()
    total_pages = max(1, math.ceil(total / page_size))

    # Pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    policies = result.scalars().all()

    return PaginatedPolicyResponse(
        items=[PolicyResponse.model_validate(p) for p in policies],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


# ── POST /policies ──────────────────────────────────────────────────────────

@router.post(
    "/policies",
    response_model=PolicyResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new DRAFT credit policy",
)
async def create_policy(
    body: PolicyCreateRequest,
    db: AsyncSession = Depends(get_async_db),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
):
    now = datetime.now(timezone.utc)
    policy = CreditPolicy(
        id=uuid.uuid4(),
        name=body.name,
        rule_schema=body.rule_schema.model_dump(by_alias=True),
        version=1,
        status=PolicyStatus.DRAFT,
        created_by=_SYSTEM_USER_ID,
        created_at=now,
        updated_at=now,
    )
    db.add(policy)
    await db.commit()
    await db.refresh(policy)
    return PolicyResponse.model_validate(policy)


# ── PUT /policies/{id} ──────────────────────────────────────────────────────

@router.put(
    "/policies/{policy_id}",
    response_model=PolicyResponse,
    status_code=status.HTTP_200_OK,
    summary="Update an existing credit policy",
)
async def update_policy(
    policy_id: uuid.UUID,
    body: PolicyUpdateRequest,
    db: AsyncSession = Depends(get_async_db),
):
    result = await db.execute(select(CreditPolicy).where(CreditPolicy.id == policy_id))
    policy = result.scalar_one_or_none()
    if policy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Policy {policy_id} not found.",
        )

    if body.name is not None:
        policy.name = body.name
    if body.rule_schema is not None:
        policy.rule_schema = body.rule_schema.model_dump(by_alias=True)
        policy.version += 1  # auto-increment on schema change
    if body.status is not None:
        policy.status = PolicyStatus(body.status.value)

    policy.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(policy)
    return PolicyResponse.model_validate(policy)


# ── POST /policies/generate (AI Text-to-Workflow) ───────────────────────────

class PolicyGenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=5, max_length=1000, description="Natural language description of the policy")

@router.post(
    "/policies/generate",
    status_code=status.HTTP_200_OK,
    summary="Generate a valid JSON policy schema from natural language using AI",
)
async def generate_policy(body: PolicyGenerateRequest):
    if not groq_client.api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY environment variable is not configured.")

    system_prompt = f"""You are an expert Credit Risk Policy Architect.
Your ONLY job is to convert the user's natural language policy criteria into a strict, exact JSON object representing the credit policy rule schema.

CRITICAL RULES:
1. You MUST output ONLY raw, valid JSON.
2. Absolutely no markdown formatting (no ```json or ```).
3. Absolutely no conversational filler or explanations.
4. The JSON must EXACTLY match the following Pydantic schema structure:

```json
{{
  "rules": [
    {{
      "id": "unique-node-id",
      "label": "Human readable label",
      "field": "dot.path.to.financial.field (e.g., data.credit_report.dscr)",
      "operator": "Must be exactly one of: {sorted(ALLOWED_OPERATORS)}",
      "value": 1.25,
      "on_true": {{
        "action": "decision" | "continue",
        "decision": "APPROVE" | "REJECT" | "MANUAL_REVIEW" (only if action is decision),
        "reason": "Explainability reason string",
        "next_rules": [ ...child rules if action is continue... ]
      }},
      "on_false": {{
         // same structure as on_true
      }}
    }}
  ],
  "default_decision": "MANUAL_REVIEW"
}}
```

Ensure the logic maps to realistic credit decisioning workflows. Handle both the happy path (Approval) and rejection paths gracefully based on the user's prompt."""

    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": body.prompt}
            ],
            temperature=0.1,  # Low temp for deterministic JSON output
            max_completion_tokens=2048,
            response_format={"type": "json_object"}
        )
        
        # Extract response text
        response_text = completion.choices[0].message.content.strip()

        # Parse strictly to dict first to ensure valid JSON syntax
        try:
            parsed_json = json.loads(response_text)
        except json.JSONDecodeError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, 
                detail=f"AI generated invalid JSON syntax: {str(e)}"
            )

        # Validate strictly against the Pydantic schema
        try:
            validated_schema = PolicyRuleSchema.model_validate(parsed_json)
        except ValidationError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, 
                detail=f"AI hallucinated invalid schema structure: {e.errors()}"
            )

        # Return the validated dict
        return validated_schema.model_dump(by_alias=True)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Groq API Error: {str(e)}")
