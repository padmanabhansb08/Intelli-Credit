"""
Approvals Router — Maker-Checker State Machine
===============================================
POST /approvals/submit              → MAKER submits a DRAFT policy for review
POST /approvals/approve/{id}        → CHECKER approves a pending request (atomic)
POST /approvals/reject/{id}         → CHECKER rejects a pending request

Role enforcement:
  - Only MAKER (or ADMIN) may submit.
  - Only CHECKER (or ADMIN) may approve/reject.
  - A Maker CANNOT approve their own submission.

All approval state transitions are wrapped in atomic DB transactions.
If any step (archive old, activate new, audit log) fails, the entire
operation rolls back to prevent state inconsistency.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from async_database import get_async_db
from async_models import (
    ApprovalRequest,
    ApprovalStatus,
    AuditLog,
    CreditPolicy,
    PolicyStatus,
    User,
    UserRole,
)
import math

router = APIRouter()


# ── Pydantic Schemas ─────────────────────────────────────────────────────────

class SubmitRequest(BaseModel):
    policy_id: uuid.UUID = Field(..., description="UUID of the DRAFT policy to submit for review")


class SubmitResponse(BaseModel):
    request_id: uuid.UUID
    policy_id: uuid.UUID
    status: str
    message: str


class ReviewRequest(BaseModel):
    comments: Optional[str] = Field(None, description="Optional reviewer comments")


class ReviewResponse(BaseModel):
    request_id: uuid.UUID
    policy_id: uuid.UUID
    status: str
    approved_by: Optional[uuid.UUID] = None
    message: str


class ApprovalRequestResponse(BaseModel):
    id: uuid.UUID
    policy_id: uuid.UUID
    policy_name: str
    policy_version: int
    requested_by: uuid.UUID
    requester_email: str
    approved_by: Optional[uuid.UUID]
    status: ApprovalStatus
    comments: Optional[str]
    created_at: datetime


class PaginatedApprovalResponse(BaseModel):
    items: list[ApprovalRequestResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class ApprovalDetailResponse(BaseModel):
    request_id: uuid.UUID
    status: ApprovalStatus
    requested_by: uuid.UUID
    requester_email: str
    created_at: datetime
    new_policy: dict
    old_policy: Optional[dict] = None


# ── User Resolution Helper ──────────────────────────────────────────────────
# In production this wires to Firebase auth.  For now, it reads X-User-Id
# and looks up the User record.

async def get_current_user(
    db: AsyncSession = Depends(get_async_db),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
) -> User:
    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-User-Id header.  Authentication required.",
        )
    try:
        uid = uuid.UUID(x_user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-User-Id must be a valid UUID.",
        )
    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {uid} not found.",
        )
    return user


# ── Role Guard Helpers ───────────────────────────────────────────────────────

def require_maker(user: User) -> None:
    """Raises 403 if the user is not a MAKER or ADMIN."""
    if user.role not in (UserRole.MAKER, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role '{user.role.value}' is not permitted to submit policies. "
                   f"Only MAKER or ADMIN roles may use this endpoint.",
        )


def require_checker(user: User) -> None:
    """Raises 403 if the user is not a CHECKER or ADMIN."""
    if user.role not in (UserRole.CHECKER, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role '{user.role.value}' is not permitted to approve/reject. "
                   f"Only CHECKER or ADMIN roles may use this endpoint.",
        )


# ── GET /approvals ──────────────────────────────────────────────────────────

@router.get(
    "/approvals",
    response_model=PaginatedApprovalResponse,
    status_code=status.HTTP_200_OK,
    summary="List Maker-Checker approval requests",
)
async def list_approvals(
    page: int = 1,
    page_size: int = 20,
    status_filter: Optional[ApprovalStatus] = None,
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(get_current_user),
):
    query = select(ApprovalRequest, CreditPolicy, User).join(
        CreditPolicy, ApprovalRequest.policy_id == CreditPolicy.id
    ).join(
        User, ApprovalRequest.requested_by == User.id
    )
    count_query = select(func.count()).select_from(ApprovalRequest)

    if status_filter:
        query = query.where(ApprovalRequest.status == status_filter)
        count_query = count_query.where(ApprovalRequest.status == status_filter)

    query = query.order_by(ApprovalRequest.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    total = (await db.execute(count_query)).scalar_one()
    total_pages = max(1, math.ceil(total / page_size))

    result = await db.execute(query)
    items = []
    for req, policy, requester in result:
        items.append({
            "id": req.id,
            "policy_id": policy.id,
            "policy_name": policy.name,
            "policy_version": policy.version,
            "requested_by": requester.id,
            "requester_email": requester.email,
            "approved_by": req.approved_by,
            "status": req.status,
            "comments": req.comments,
            "created_at": req.created_at,
        })

    return PaginatedApprovalResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


# ── GET /approvals/{request_id} ──────────────────────────────────────────────

@router.get(
    "/approvals/{request_id}",
    response_model=ApprovalDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get detailed view of an approval request including schema diff",
)
async def get_approval_detail(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(get_current_user),
):
    query = select(ApprovalRequest, CreditPolicy, User).join(
        CreditPolicy, ApprovalRequest.policy_id == CreditPolicy.id
    ).join(
        User, ApprovalRequest.requested_by == User.id
    ).where(ApprovalRequest.id == request_id)

    result = await db.execute(query)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Request not found.")

    req, policy, requester = row

    # Find the currently active policy with the same name to show diff
    old_active_result = await db.execute(
        select(CreditPolicy).where(
            CreditPolicy.name == policy.name,
            CreditPolicy.status == PolicyStatus.ACTIVE,
            CreditPolicy.id != policy.id
        )
    )
    old_active = old_active_result.scalar_one_or_none()

    old_policy_dict = None
    if old_active:
        old_policy_dict = {
            "id": str(old_active.id),
            "name": old_active.name,
            "version": old_active.version,
            "rule_schema": old_active.rule_schema,
        }

    return ApprovalDetailResponse(
        request_id=req.id,
        status=req.status,
        requested_by=requester.id,
        requester_email=requester.email,
        created_at=req.created_at,
        new_policy={
            "id": str(policy.id),
            "name": policy.name,
            "version": policy.version,
            "rule_schema": policy.rule_schema,
        },
        old_policy=old_policy_dict,
    )


# ── POST /approvals/submit ──────────────────────────────────────────────────

@router.post(
    "/approvals/submit",
    response_model=SubmitResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a DRAFT policy for Checker review",
)
async def submit_for_review(
    body: SubmitRequest,
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(get_current_user),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
):
    # 1. Role guard — CHECKERs cannot submit
    require_maker(user)

    # 2. Fetch the policy
    result = await db.execute(
        select(CreditPolicy).where(CreditPolicy.id == body.policy_id)
    )
    policy = result.scalar_one_or_none()
    if policy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Policy {body.policy_id} not found.",
        )
    if policy.status != PolicyStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Policy is in '{policy.status.value}' state. Only DRAFT policies can be submitted.",
        )

    # 3. Transition policy → PENDING_REVIEW
    policy.status = PolicyStatus.PENDING_REVIEW
    policy.updated_at = datetime.now(timezone.utc)

    # 4. Create an ApprovalRequest
    approval_req = ApprovalRequest(
        id=uuid.uuid4(),
        policy_id=policy.id,
        requested_by=user.id,
        status=ApprovalStatus.PENDING,
        created_at=datetime.now(timezone.utc),
    )
    db.add(approval_req)
    await db.commit()
    await db.refresh(approval_req)

    return SubmitResponse(
        request_id=approval_req.id,
        policy_id=policy.id,
        status="PENDING_REVIEW",
        message=f"Policy '{policy.name}' submitted for review by {user.email}.",
    )


# ── POST /approvals/approve/{request_id} ────────────────────────────────────

@router.post(
    "/approvals/approve/{request_id}",
    response_model=ReviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Approve a pending policy submission (atomic transaction)",
)
async def approve_request(
    request_id: uuid.UUID,
    body: ReviewRequest = ReviewRequest(),
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(get_current_user),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
):
    # 1. Role guard — MAKERs cannot approve
    require_checker(user)

    # 2. Fetch the approval request
    result = await db.execute(
        select(ApprovalRequest).where(ApprovalRequest.id == request_id)
    )
    approval_req = result.scalar_one_or_none()
    if approval_req is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Approval request {request_id} not found.",
        )
    if approval_req.status != ApprovalStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Request is already '{approval_req.status.value}'. Cannot approve.",
        )

    # 3. Self-approval prevention — Maker cannot approve their own submission
    if approval_req.requested_by == user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Self-approval is prohibited. The submitting Maker cannot approve their own request.",
        )

    # 4. Fetch the policy being approved
    policy_result = await db.execute(
        select(CreditPolicy).where(CreditPolicy.id == approval_req.policy_id)
    )
    policy = policy_result.scalar_one_or_none()
    if policy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated policy not found.",
        )

    # ── ATOMIC TRANSACTION ───────────────────────────────────────────────
    # All three operations must succeed together, or all roll back.
    now = datetime.now(timezone.utc)

    try:
        # 4a. Archive the currently ACTIVE policy with the same name (if any)
        active_result = await db.execute(
            select(CreditPolicy).where(
                CreditPolicy.name == policy.name,
                CreditPolicy.status == PolicyStatus.ACTIVE,
                CreditPolicy.id != policy.id,
            )
        )
        old_active = active_result.scalar_one_or_none()

        old_payload = None
        if old_active is not None:
            old_payload = {
                "id": str(old_active.id),
                "name": old_active.name,
                "version": old_active.version,
                "rule_schema": old_active.rule_schema,
            }
            old_active.status = PolicyStatus.ARCHIVED
            old_active.updated_at = now

        # 4b. Set the new policy to ACTIVE
        policy.status = PolicyStatus.ACTIVE
        policy.updated_at = now

        # 4c. Mark the approval request as APPROVED
        approval_req.status = ApprovalStatus.APPROVED
        approval_req.approved_by = user.id
        approval_req.comments = body.comments

        # 4d. Insert comprehensive AuditLog
        audit = AuditLog(
            id=uuid.uuid4(),
            user_id=user.id,
            action="POLICY_APPROVED",
            entity_type="CreditPolicy",
            entity_id=policy.id,
            payload={
                "new_policy": {
                    "id": str(policy.id),
                    "name": policy.name,
                    "version": policy.version,
                    "rule_schema": policy.rule_schema,
                },
                "archived_policy": old_payload,
                "approval_request_id": str(approval_req.id),
                "approved_by": str(user.id),
                "approver_email": user.email,
                "maker_id": str(approval_req.requested_by),
                "comments": body.comments,
            },
            created_at=now,
        )
        db.add(audit)

        # Commit ALL changes atomically
        await db.commit()

    except Exception:
        # If ANYTHING fails (even audit log insertion), roll back everything
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Atomic transaction failed. All changes have been rolled back.",
        )

    return ReviewResponse(
        request_id=approval_req.id,
        policy_id=policy.id,
        status="APPROVED",
        approved_by=user.id,
        message=f"Policy '{policy.name}' v{policy.version} is now ACTIVE. "
                f"Previous active version has been archived.",
    )


# ── POST /approvals/reject/{request_id} ────────────────────────────────────

@router.post(
    "/approvals/reject/{request_id}",
    response_model=ReviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Reject a pending policy submission",
)
async def reject_request(
    request_id: uuid.UUID,
    body: ReviewRequest = ReviewRequest(),
    db: AsyncSession = Depends(get_async_db),
    user: User = Depends(get_current_user),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
):
    # 1. Role guard — MAKERs cannot reject
    require_checker(user)

    # 2. Fetch the approval request
    result = await db.execute(
        select(ApprovalRequest).where(ApprovalRequest.id == request_id)
    )
    approval_req = result.scalar_one_or_none()
    if approval_req is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Approval request {request_id} not found.",
        )
    if approval_req.status != ApprovalStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Request is already '{approval_req.status.value}'. Cannot reject.",
        )

    now = datetime.now(timezone.utc)

    try:
        # Revert policy back to DRAFT
        policy_result = await db.execute(
            select(CreditPolicy).where(CreditPolicy.id == approval_req.policy_id)
        )
        policy = policy_result.scalar_one_or_none()
        if policy:
            policy.status = PolicyStatus.DRAFT
            policy.updated_at = now

        # Mark request as REJECTED
        approval_req.status = ApprovalStatus.REJECTED
        approval_req.approved_by = user.id
        approval_req.comments = body.comments

        # Audit log
        audit = AuditLog(
            id=uuid.uuid4(),
            user_id=user.id,
            action="POLICY_REJECTED",
            entity_type="CreditPolicy",
            entity_id=approval_req.policy_id,
            payload={
                "approval_request_id": str(approval_req.id),
                "rejected_by": str(user.id),
                "reviewer_email": user.email,
                "maker_id": str(approval_req.requested_by),
                "comments": body.comments,
            },
            created_at=now,
        )
        db.add(audit)

        await db.commit()

    except Exception:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Transaction failed. All changes have been rolled back.",
        )

    return ReviewResponse(
        request_id=approval_req.id,
        policy_id=approval_req.policy_id,
        status="REJECTED",
        approved_by=user.id,
        message=f"Request {request_id} has been rejected. Policy reverted to DRAFT.",
    )
