from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel, Field
from typing import List, Optional
from async_database import get_async_db
from async_models import BorrowerEntity, CreditApplication, ImmutableAuditLog

router = APIRouter()

class BorrowerCreate(BaseModel):
    id: str = Field(..., description="Borrower unique identifier")
    name: str
    industry: Optional[str] = None
    constitution: Optional[str] = None

class ApplicationCreate(BaseModel):
    id: str = Field(..., description="Application unique identifier")
    borrower_id: str
    facility_amount: Optional[float] = None
    currency: Optional[str] = "INR"
    purpose: Optional[str] = None
    term_months: Optional[int] = None

class ApplicationUpdate(BaseModel):
    status: Optional[str] = None
    decision: Optional[str] = None
    recommended_limit: Optional[float] = None
    grade: Optional[str] = None
    composite_score: Optional[float] = None
    pd_score: Optional[float] = None

class ApplicationResponse(BaseModel):
    id: str
    borrower: dict
    status: str
    facility_amount: Optional[float]
    currency: str
    purpose: Optional[str]
    term_months: Optional[int]
    recommended_limit: Optional[float]
    decision: Optional[str]
    grade: Optional[str]
    composite_score: Optional[float]
    pd_score: Optional[float]
    created_at: str
    updated_at: str
    audit_log: Optional[dict] = None

@router.post("/applications", response_model=ApplicationResponse)
async def create_application(payload: ApplicationCreate, db: AsyncSession = Depends(get_async_db)):
    borrower = (await db.execute(select(BorrowerEntity).filter(BorrowerEntity.id == payload.borrower_id))).scalar_one_or_none()
    if not borrower:
        raise HTTPException(status_code=404, detail="Borrower not found")
    app = CreditApplication(
        id=payload.id,
        borrower_id=payload.borrower_id,
        facility_amount=payload.facility_amount,
        currency=payload.currency,
        purpose=payload.purpose,
        term_months=payload.term_months,
    )
    db.add(app)
    await db.commit()
    await db.refresh(app)
    return ApplicationResponse(
        id=app.id,
        borrower={"id": borrower.id, "name": borrower.name},
        status=app.status,
        facility_amount=app.facility_amount,
        currency=app.currency,
        purpose=app.purpose,
        term_months=app.term_months,
        recommended_limit=app.recommended_limit,
        decision=app.decision,
        grade=app.grade,
        composite_score=app.composite_score,
        pd_score=app.pd_score,
        created_at=app.created_at.isoformat(),
        updated_at=app.updated_at.isoformat(),
        audit_log=None,
    )

@router.get("/applications", response_model=List[ApplicationResponse])
async def list_applications(db: AsyncSession = Depends(get_async_db)):
    apps = (await db.execute(select(CreditApplication))).scalars().all()
    result = []
    for app in apps:
        borrower = (await db.execute(select(BorrowerEntity).filter(BorrowerEntity.id == app.borrower_id))).scalar_one_or_none()
        audit = (await db.execute(select(ImmutableAuditLog).filter(ImmutableAuditLog.application_id == app.id))).scalar_one_or_none()
        result.append(
            ApplicationResponse(
                id=app.id,
                borrower={"id": borrower.id, "name": borrower.name} if borrower else None,
                status=app.status,
                facility_amount=app.facility_amount,
                currency=app.currency,
                purpose=app.purpose,
                term_months=app.term_months,
                recommended_limit=app.recommended_limit,
                decision=app.decision,
                grade=app.grade,
                composite_score=app.composite_score,
                pd_score=app.pd_score,
                created_at=app.created_at.isoformat(),
                updated_at=app.updated_at.isoformat(),
                audit_log={
                    "id": audit.id,
                    "exact_timestamp": audit.exact_timestamp.isoformat(),
                    "input_payload_json": audit.input_payload_json,
                    "ruleset_json": audit.ruleset_json,
                    "deterministic_outcome_json": audit.deterministic_outcome_json,
                } if audit else None,
            )
        )
    return result

@router.get("/applications/{app_id}", response_model=ApplicationResponse)
async def get_application(app_id: str, db: AsyncSession = Depends(get_async_db)):
    app = (await db.execute(select(CreditApplication).filter(CreditApplication.id == app_id))).scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    borrower = (await db.execute(select(BorrowerEntity).filter(BorrowerEntity.id == app.borrower_id))).scalar_one_or_none()
    audit = (await db.execute(select(ImmutableAuditLog).filter(ImmutableAuditLog.application_id == app.id))).scalar_one_or_none()
    return ApplicationResponse(
        id=app.id,
        borrower={"id": borrower.id, "name": borrower.name} if borrower else None,
        status=app.status,
        facility_amount=app.facility_amount,
        currency=app.currency,
        purpose=app.purpose,
        term_months=app.term_months,
        recommended_limit=app.recommended_limit,
        decision=app.decision,
        grade=app.grade,
        composite_score=app.composite_score,
        pd_score=app.pd_score,
        created_at=app.created_at.isoformat(),
        updated_at=app.updated_at.isoformat(),
        audit_log={
            "id": audit.id,
            "exact_timestamp": audit.exact_timestamp.isoformat(),
            "input_payload_json": audit.input_payload_json,
            "ruleset_json": audit.ruleset_json,
            "deterministic_outcome_json": audit.deterministic_outcome_json,
        } if audit else None,
    )

@router.put("/applications/{app_id}", response_model=ApplicationResponse)
async def update_application(app_id: str, payload: ApplicationUpdate, db: AsyncSession = Depends(get_async_db)):
    app = (await db.execute(select(CreditApplication).filter(CreditApplication.id == app_id))).scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(app, field, value)
    await db.commit()
    await db.refresh(app)
    audit = ImmutableAuditLog(
        application_id=app.id,
        input_payload_json=payload.dict(exclude_unset=True),
        ruleset_json={},
        deterministic_outcome_json={
            "status": app.status,
            "decision": app.decision,
            "recommended_limit": app.recommended_limit,
        },
    )
    db.add(audit)
    await db.commit()
    borrower = (await db.execute(select(BorrowerEntity).filter(BorrowerEntity.id == app.borrower_id))).scalar_one_or_none()
    return ApplicationResponse(
        id=app.id,
        borrower={"id": borrower.id, "name": borrower.name} if borrower else None,
        status=app.status,
        facility_amount=app.facility_amount,
        currency=app.currency,
        purpose=app.purpose,
        term_months=app.term_months,
        recommended_limit=app.recommended_limit,
        decision=app.decision,
        grade=app.grade,
        composite_score=app.composite_score,
        pd_score=app.pd_score,
        created_at=app.created_at.isoformat(),
        updated_at=app.updated_at.isoformat(),
        audit_log={
            "id": audit.id,
            "exact_timestamp": audit.exact_timestamp.isoformat(),
            "input_payload_json": audit.input_payload_json,
            "ruleset_json": audit.ruleset_json,
            "deterministic_outcome_json": audit.deterministic_outcome_json,
        },
    )
