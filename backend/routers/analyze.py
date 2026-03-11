from datetime import datetime
import json
import logging
import uuid
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Security, UploadFile
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from modules.decision_engine import generate_audit_trail, make_decision
from modules.feature_store import list_analyses, load_features, save_features, save_full_analysis, load_full_analysis
from modules.ingestion import (
    compute_financial_ratios,
    fetch_gst_from_databricks,
    parse_bank_statement_csv,
    parse_bureau_json,
    parse_financial_pdf,
    reconcile_gst_with_bank,
)
from modules.ml_engine import (
    compute_risk_premium,
    get_model_metrics,
    get_shap_explanation,
    load_models,
    predict_limit,
    predict_pd,
)
from modules.risk_synthesis import compute_capital_impact, compute_composite_risk
from modules.stress_test import run_stress_test
from modules.web_research import simulate_web_research

router = APIRouter()
ANALYSIS_DB: Dict[str, Dict[str, Dict[str, Any]]] = {}

security = HTTPBearer(auto_error=False)
API_KEYS = {
    "sk_live_hdfc_9x2b": {"tenant_id": "tnt_hdfc_01", "tier": "enterprise", "webhook_url": "https://api.hdfc.com/v1/intelli-credit/webhook"},
    "sk_live_icici_4a1f": {"tenant_id": "tnt_icici_02", "tier": "enterprise", "webhook_url": "https://api.icici.com/webhooks/cam-ready"},
}


from security.auth import verify_firebase_token

async def get_tenant(credentials: HTTPAuthorizationCredentials = Security(security)) -> Dict[str, Any]:
    """Dependency to extract and validate B2B tenant from API Key or Firebase Auth."""
    if not credentials:
        return {"tenant_id": "tnt_b2c_individual", "tier": "free", "webhook_url": None}

    token = credentials.credentials
    tenant = API_KEYS.get(token)
    
    if tenant:
        return tenant
        
    # If not a static API key, attempt to verify as a Firebase JWT
    try:
        decoded_token = verify_firebase_token(credentials)
        return {
            "tenant_id": decoded_token.get("uid", "firebase_user"),
            "tier": "enterprise",
            "webhook_url": None
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid Authentication Token")


async def dispatch_webhook(webhook_url: str, analysis_id: str, decision: str, limit: float):
    """Asynchronously dispatch completion payload to B2B institutional client."""
    if not webhook_url:
        return

    payload = {
        "event": "cam_generation.completed",
        "analysis_id": analysis_id,
        "decision": decision,
        "approved_limit": limit,
        "timestamp": datetime.utcnow().isoformat(),
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(webhook_url, json=payload)
            logging.info("Webhook dispatched to %s for analysis %s", webhook_url, analysis_id)
    except Exception as exc:
        logging.error("Webhook dispatch failed for %s: %s", analysis_id, exc)


class CustomerDetails(BaseModel):
    name: str = ""
    id: str = ""
    industry: str = "Manufacturing"
    constitution: str = ""


class FinancialDetails(BaseModel):
    operating_income: float = 0
    non_operating_income: float = 0
    short_term_liab: float = 0
    long_term_liab: float = 0
    contingent_liab: float = 0
    internal_rating: str = ""
    external_rating: str = ""
    bureau_score: int = 700
    current_assets: float = 0
    fixed_assets: float = 0
    intangible_assets: float = 0


class FacilityDetails(BaseModel):
    amount: float = 0
    currency: str = "INR"
    purpose: str = ""
    term_months: int = 12
    repayment_method: str = "EMI"


class WriteupDetails(BaseModel):
    swot: str = ""
    business_overview: str = ""
    policy_exceptions: str = ""


class ExposureDetails(BaseModel):
    internal: float = 0
    external: float = 0
    parent_child: float = 0
    geography: str = "Low"
    industry: str = "Medium"
    entity: str = "Low"


class ApprovalStatus(BaseModel):
    risk_dept: str = "Pending"
    legal_dept: str = "Pending"
    compliance: str = "Pending"


class AnalyzeRequest(BaseModel):
    analysis_id: str
    customer: CustomerDetails
    financials: FinancialDetails
    facility: FacilityDetails
    collateral_list: List[dict] = []
    writeup: WriteupDetails
    kyc_status: str = "Pending"
    exposure: ExposureDetails
    approval: ApprovalStatus
    remarks: List[str] = []


def _ensure_session(tenant_id: str, analysis_id: str, status: str = "INITIATED") -> Dict[str, Any]:
    tenant_db = ANALYSIS_DB.setdefault(tenant_id, {})
    session = tenant_db.setdefault(analysis_id, {"raw_extracts": {}, "status": status})
    session.setdefault("raw_extracts", {})
    session.setdefault("status", status)
    return session


def _build_financial_payload(req: AnalyzeRequest, session: Dict[str, Any]) -> Dict[str, Any]:
    uploaded_financials = session.get("raw_extracts", {}).get("financial_pdf", {})
    manual_financials = {
        "revenue": req.financials.operating_income,
        "net_income": req.financials.operating_income * 0.12 if req.financials.operating_income else 0,
        "total_assets": req.financials.current_assets + req.financials.fixed_assets + req.financials.intangible_assets,
        "total_liabilities": req.financials.short_term_liab + req.financials.long_term_liab + req.financials.contingent_liab,
        "total_debt": req.financials.long_term_liab,
        "current_assets": req.financials.current_assets,
        "current_liabilities": req.financials.short_term_liab,
        "short_term_liab": req.financials.short_term_liab,
        "long_term_liab": req.financials.long_term_liab,
        "contingent_liab": req.financials.contingent_liab,
    }
    manual_financials["total_equity"] = max(manual_financials["total_assets"] - manual_financials["total_liabilities"], 0)

    merged = dict(manual_financials)
    for key, value in uploaded_financials.items():
        if value not in (None, "", [], {}):
            merged[key] = value

    if not merged.get("total_equity") and merged.get("total_assets") is not None and merged.get("total_liabilities") is not None:
        merged["total_equity"] = max(float(merged["total_assets"]) - float(merged["total_liabilities"]), 0)
    return merged


def _dump_model(model: BaseModel) -> Dict[str, Any]:
    return model.model_dump() if hasattr(model, "model_dump") else model.dict()


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    doc_type: str = Form(...),
    analysis_id: Optional[str] = Form(None),
    tenant: Dict = Depends(get_tenant),
):
    """Upload and parse a document, returning a temporary analysis_id."""
    filename = getattr(file, "filename", "") or ""
    if not filename.lower().endswith((".pdf", ".csv")):
        raise HTTPException(status_code=400, detail={"error": "Unsupported file type. Strictly .pdf and .csv are allowed."})

    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail={"error": "File size exceeds 50MB limit."})

    analysis_id = analysis_id or str(uuid.uuid4())
    tenant_id = tenant["tenant_id"]

    if doc_type == "financial_pdf":
        extracted = parse_financial_pdf(content)
    elif doc_type == "bank_csv":
        extracted = parse_bank_statement_csv(content)
    elif doc_type == "bureau_json":
        try:
            extracted = parse_bureau_json(json.loads(content.decode("utf-8")))
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Invalid bureau JSON: {exc}") from exc
    else:
        raise HTTPException(status_code=400, detail="Invalid doc_type")

    session = _ensure_session(tenant_id, analysis_id, status="UPLOADED")
    session["raw_extracts"][doc_type] = extracted
    session["status"] = "UPLOADED"

    return {
        "status": "success",
        "analysis_id": analysis_id,
        "message": f"Successfully parsed and stored {file.filename} in datastore",
        "extracted_data": extracted,
    }


from services.external_aggregator import ExternalDataAggregator

@router.post("/analyze")
async def run_full_analysis(
    req: AnalyzeRequest,
    background_tasks: BackgroundTasks,
    tenant: Dict = Depends(get_tenant),
):
    """Run the complete end-to-end credit decisioning pipeline."""
    try:
        load_models()
    except Exception as exc:
        print(f"Warning: models not available for eager load. Falling back at runtime. {exc}")

    tenant_id = tenant["tenant_id"]
    session = _ensure_session(tenant_id, req.analysis_id, status="INITIATED_VIA_LOS")

    financials = _build_financial_payload(req, session)
    bank_data = session.get("raw_extracts", {}).get("bank_csv", {})
    bureau_data = session.get("raw_extracts", {}).get("bureau_json", {"bureau_score": req.financials.bureau_score})
    total_collateral_value = sum(float(item.get("value", 0) or 0) for item in req.collateral_list)

    features = compute_financial_ratios(
        financials=financials,
        bank_data=bank_data,
        bureau_data=bureau_data,
        collateral_value=total_collateral_value,
        loan_amount=req.facility.amount,
    )

    gst_data = fetch_gst_from_databricks(str(req.analysis_id))
    gst_bank_metrics = reconcile_gst_with_bank(gst_data, bank_data)
    features.update(gst_data)
    features.update(gst_bank_metrics)
    
    # ----------------------------------------------------
    # REAL EXTERNAL API INTEGRATION
    # ----------------------------------------------------
    aggregator = ExternalDataAggregator()
    # In a real app, gstin/cin/pan would be populated from the LOS/request payload.
    # Using dummy/placeholder identifiers if not provided by the frontend.
    ext_data = await aggregator.aggregate_borrower_facts(
        company_name=req.customer.name,
        company_id=req.customer.id,
        gstin=f"27{req.customer.id}1Z5"[:15],  # Fake GSTIN based on ID for demo
        cin=f"U74999MH2023PTC{req.customer.id}"[:21],  # Fake CIN based on ID
        pan=f"ABCDE{req.customer.id}F"[:10]  # Fake PAN based on ID
    )

    # Merge the rigorous unified BorrowerFact into the feature set for the decision engine
    features.update(ext_data)

    features["company_name"] = req.customer.name
    features["industry"] = req.customer.industry
    features["existing_exposure"] = req.exposure.internal + req.exposure.external + req.exposure.parent_child
    
    # Override bureau values with real API data if available
    real_vintage = ext_data.get("cibil_credit_history_months", 0)
    vintage_months = real_vintage if real_vintage > 0 else float(bureau_data.get("credit_history_months", 60) or 60)
    features["years_in_business"] = max(1.0, round(vintage_months / 12.0, 1))
    
    if ext_data.get("cibil_commercial_score", -1) > 0:
        # Scale CMR (typically 1-10) to 300-900 equivalent for the existing logic, or use directly if 300-900
        cmr = ext_data["cibil_commercial_score"]
        if cmr <= 10:
            # Map CMR 1-10 to Bureau Score 300-900 (rough proxy: 1 is best)
            features["bureau_score"] = int(900 - (cmr - 1) * (600 / 9))
        else:
            features["bureau_score"] = cmr

    web_research_data = await simulate_web_research(
        company_name=req.customer.name,
        industry=req.customer.industry,
        revenue=features.get("revenue", 0),
        bureau_score=features.get("bureau_score", 700),
        site_visit_insights=req.writeup.business_overview,
        management_interview_notes=req.writeup.swot,
    )
    features["industry_risk"] = web_research_data.get("industry_macro", {}).get("risk_factor", 0.3)

    save_features(req.analysis_id, features)

    try:
        pd_score, _ = predict_pd(features)
        recommended_limit = predict_limit(features)
        shap_explanation = get_shap_explanation(features)
        model_metrics = get_model_metrics()
    except Exception as exc:
        print(f"ML inference fallback engaged: {exc}")
        pd_score = 0.15
        recommended_limit = req.facility.amount * 0.8
        shap_explanation = {"top_5_factors": []}
        model_metrics = {}

    primary_insight_bps = web_research_data.get("primary_insights", {}).get("impact_bps", 0)
    risk_premium = compute_risk_premium(
        pd_score=pd_score,
        industry_risk=features.get("industry_risk", 0.3),
        collateral_coverage=features.get("collateral_coverage", 1.0),
    )
    if req.writeup.policy_exceptions:
        primary_insight_bps += 100
    risk_premium["total_rate_bps"] += primary_insight_bps
    risk_premium["total_rate"] = risk_premium["total_rate_bps"] / 10000.0

    stress_results = run_stress_test(features, pd_score)
    composite_risk = compute_composite_risk(pd_score, features, web_research_data, stress_results)
    exposure_penalty = 15 if req.exposure.industry == "High" or req.exposure.geography == "High" else 0
    composite_risk["composite_score"] = min(100, composite_risk.get("composite_score", 50) + exposure_penalty)

    capital_impact = compute_capital_impact(
        loan_amount=req.facility.amount,
        pd_score=pd_score,
        composite_score=composite_risk.get("composite_score", 50),
    )

    decision_result = make_decision(
        pd_score=pd_score,
        composite_risk=composite_risk,
        web_research=web_research_data,
        features=features,
        shap_explanation=shap_explanation,
        recommended_limit=recommended_limit,
        risk_premium=risk_premium,
    )
    
    # 7.5 Inject summarized company profile directly into decision payload for CAM routing
    decision_result["company_summary"] = web_research_data.get("company_profile", "")

    # 7.6 Phase 6 - Five Cs of Credit Synthesis
    from modules.llm_five_c_analyzer import synthesize_five_cs
    decision_result["five_c_synthesis"] = synthesize_five_cs(features, web_research_data)

    audit_trail = generate_audit_trail(
        analysis_id=req.analysis_id,
        company_name=req.customer.name,
        industry=req.customer.industry,
        decision_result=decision_result,
        features=features,
        web_research=web_research_data,
        stress_test=stress_results,
    )

    full_result = {
        "analysis_id": req.analysis_id,
        "company_name": req.customer.name,
        "industry": req.customer.industry,
        "decision": decision_result,
        "features": features,
        "web_research": web_research_data,
        "stress_test": stress_results,
        "composite_risk": composite_risk,
        "risk_premium": risk_premium,
        "capital_impact": capital_impact,
        "shap_explanation": shap_explanation,
        "audit_trail": audit_trail,
        "model_metrics": model_metrics,
        "workflow_state": _dump_model(req.approval),
    }

    session["full_result"] = full_result
    session["status"] = "COMPLETED"

    save_full_analysis(req.analysis_id, full_result)

    if tenant.get("webhook_url"):
        background_tasks.add_task(
            dispatch_webhook,
            tenant["webhook_url"],
            req.analysis_id,
            decision_result.get("decision", "PENDING"),
            decision_result.get("summary", {}).get("recommended_limit", 0),
        )

    return full_result


@router.get("/analyses")
async def get_all_analyses():
    """List all past analyses (from feature store)."""
    return {"analyses": list_analyses()}


@router.get("/metrics")
async def get_system_metrics():
    """Return model performance and bias metrics for the dashboard."""
    return get_model_metrics()


@router.post("/drafts/save")
async def save_los_draft(req: AnalyzeRequest, tenant: Dict = Depends(get_tenant)):
    """Save an in-progress Credit Proposal Draft to the tenant datastore."""
    session = _ensure_session(tenant["tenant_id"], req.analysis_id, status="DRAFT")
    session["draft_payload"] = _dump_model(req)
    session["status"] = "DRAFT"
    return {"status": "success", "message": "Draft saved securely.", "analysis_id": req.analysis_id}


@router.get("/drafts/load/{analysis_id}")
async def load_los_draft(analysis_id: str, tenant: Dict = Depends(get_tenant)):
    """Load an in-progress Credit Proposal Draft."""
    session = ANALYSIS_DB.get(tenant["tenant_id"], {}).get(analysis_id)
    if not session or "draft_payload" not in session:
        raise HTTPException(status_code=404, detail="Draft not found")
    return {"status": "success", "draft": session["draft_payload"]}


@router.get("/drafts/all")
async def get_all_drafts(tenant: Dict = Depends(get_tenant)):
    """Return all drafts for the specific tenant."""
    drafts_list = []
    for analysis_id, session_data in ANALYSIS_DB.get(tenant["tenant_id"], {}).items():
        if session_data.get("status") == "DRAFT":
            draft_payload = session_data.get("draft_payload", {})
            drafts_list.append(
                {
                    "analysis_id": analysis_id,
                    "company_name": draft_payload.get("customer", {}).get("name", "Unnamed Draft"),
                    "status": "DRAFT",
                    "limit_recommendation": draft_payload.get("facility", {}).get("amount", 0),
                }
            )
    return {"drafts": drafts_list}
