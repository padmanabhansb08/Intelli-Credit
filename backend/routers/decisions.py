"""
Decisions Router — Evaluate loan applications against credit policies
=====================================================================
POST /decisions/evaluate  → invoke dynamic_scorer and return decision + trail
"""
from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from async_database import get_async_db
from async_models import CreditPolicy
from dynamic_scorer import evaluate_policy
from schemas_v2 import DecisionEvaluateRequest, DecisionEvaluateResponse

router = APIRouter()


@router.post(
    "/decisions/evaluate",
    response_model=DecisionEvaluateResponse,
    status_code=status.HTTP_200_OK,
    summary="Evaluate financial data against a credit policy",
    responses={
        404: {"description": "Policy not found"},
        422: {"description": "Validation error in request payload"},
    },
)
async def evaluate_decision(
    body: DecisionEvaluateRequest,
    db: AsyncSession = Depends(get_async_db),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
):
    """
    Accepts loan application financial data and a policy_id.
    Retrieves the policy's rule_schema from the database, invokes the
    recursive dynamic_scorer engine, and returns the decision with
    a full execution trail for regulatory explainability.
    """
    # 1. Fetch the active policy
    result = await db.execute(
        select(CreditPolicy).where(CreditPolicy.id == body.policy_id)
    )
    policy = result.scalar_one_or_none()

    if policy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Credit policy {body.policy_id} not found.",
        )

    # 2. Invoke the recursive scorer
    outcome = evaluate_policy(
        financial_data=body.financial_data,
        policy_schema=policy.rule_schema,
    )

    # 3. Return standardised response
    return DecisionEvaluateResponse(
        decision=outcome["decision"],
        reason=outcome["reason"],
        execution_trail=outcome["execution_trail"],
        nodes_triggered=outcome["nodes_triggered"],
        policy_id=body.policy_id,
        idempotency_key=idempotency_key,
    )
