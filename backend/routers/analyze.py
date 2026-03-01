from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import uuid
import os
import httpx
import logging

from modules.ingestion import parse_financial_pdf, parse_bank_statement_csv, parse_bureau_json, compute_financial_ratios, fetch_gst_from_databricks
from modules.ml_engine import predict_pd, predict_limit, compute_risk_premium, get_shap_explanation, load_models, get_model_metrics
from modules.web_research import simulate_web_research
from modules.risk_synthesis import compute_composite_risk, compute_capital_impact
from modules.decision_engine import make_decision, generate_audit_trail
from modules.feature_store import save_features, load_features, list_analyses
from modules.stress_test import run_stress_test


router = APIRouter()

# Mocking Database/Databricks state backend for API reliability
# In production, this integrates via the Databricks connection module
ANALYSIS_DB = {}

# --- SAAS MULTI-TENANCY & B2B ISOLATION ---
security = HTTPBearer(auto_error=False) # Optional for UI, Required for B2B

# Mock API Key database for institutional clients
API_KEYS = {
    "sk_live_hdfc_9x2b": {"tenant_id": "tnt_hdfc_01", "tier": "enterprise", "webhook_url": "https://api.hdfc.com/v1/intelli-credit/webhook"},
    "sk_live_icici_4a1f": {"tenant_id": "tnt_icici_02", "tier": "enterprise", "webhook_url": "https://api.icici.com/webhooks/cam-ready"},
}

async def get_tenant(credentials: HTTPAuthorizationCredentials = Security(security)) -> Dict[str, Any]:
    """Dependency to extract and validate B2B tenant from API Key."""
    if not credentials:
        # Fallback to a default default tenant for the B2C React Frontend demo
        return {"tenant_id": "tnt_b2c_individual", "tier": "free", "webhook_url": None}
    
    token = credentials.credentials
    tenant = API_KEYS.get(token)
    if not tenant:
        raise HTTPException(status_code=401, detail="Invalid API Key")
    return tenant


async def dispatch_webhook(webhook_url: str, analysis_id: str, decision: str, limit: float):
    """Asynchronously dispatch completion payload to B2B institutional client."""
    if not webhook_url: return
    
    payload = {
        "event": "cam_generation.completed",
        "analysis_id": analysis_id,
        "decision": decision,
        "approved_limit": limit,
        "timestamp": httpx.utils.format_date_time(httpx.utils.normalize_header_value(httpx.utils.format_date_time(1))) # Just mock string
    }
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            # Fire and forget webhook
            await client.post(webhook_url, json=payload)
            logging.info(f"Webhook dispatched to {webhook_url} for analysis {analysis_id}")
    except Exception as e:
        logging.error(f"Webhook dispatch failed: {e}")


# Nested schemas for the massive LOS UI state
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

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    doc_type: str = Form(...),  # 'financial_pdf', 'bank_csv', 'bureau_json'
    tenant: Dict = Depends(get_tenant)
):
    """Upload and parse a document, returning a temporary analysis_id."""
    content = await file.read()
    analysis_id = str(uuid.uuid4())
    tenant_id = tenant["tenant_id"]

    if doc_type == "financial_pdf":
        extracted = parse_financial_pdf(content)
    elif doc_type == "bank_csv":
        extracted = parse_bank_statement_csv(content)
    elif doc_type == "bureau_json":
        import json
        try:
            data = json.loads(content.decode("utf-8"))
            extracted = parse_bureau_json(data)
        except Exception:
            extracted = {"error": "Invalid JSON"}
    else:
        raise HTTPException(status_code=400, detail="Invalid doc_type")

    # Enforce Row-Level Security (RLS) partition by tenant
    if tenant_id not in ANALYSIS_DB:
        ANALYSIS_DB[tenant_id] = {}

    ANALYSIS_DB[tenant_id][analysis_id] = {
        "raw_extracts": {doc_type: extracted},
        "status": "UPLOADED"
    }

    return {
        "status": "success",
        "analysis_id": analysis_id,
        "message": f"Successfully parsed and stored {file.filename} in datastore",
        "extracted_data": extracted
    }


@router.post("/analyze")
async def run_full_analysis(
    req: AnalyzeRequest, 
    background_tasks: BackgroundTasks,
    tenant: Dict = Depends(get_tenant)
):
    """Run the complete end-to-end credit decisioning pipeline."""
    try:
        # Load ML models on first request if not already in memory
        load_models()
    except Exception as e:
        print(f"Warning: Models not found, attempting to load later. {e}")

    tenant_id = tenant["tenant_id"]

    # Connect and pull data for analysis id mapping, strictly enforcing tenant isolation
    tenant_db = ANALYSIS_DB.get(tenant_id, {})
    session = tenant_db.get(req.analysis_id, {})
    
    # If no session exists (e.g. initiated entirely from the new LOS UI wizard without PDF drop)
    # create a fresh isolated session container in the Databricks mock
    if not session:
        if tenant_id not in ANALYSIS_DB:
            ANALYSIS_DB[tenant_id] = {}
        ANALYSIS_DB[tenant_id][req.analysis_id] = {
            "raw_extracts": {},
            "status": "INITIATED_VIA_LOS"
        }
        session = ANALYSIS_DB[tenant_id][req.analysis_id]

    # 1. Gather extracted data or fetch from Databricks storage
    financials = session.get("raw_extracts", {}).get("financial_pdf", {
        "revenue": req.financials.operating_income,
        "net_profit": req.financials.operating_income * 0.15, # Mock 15% margin
        "total_assets": req.financials.current_assets + req.financials.fixed_assets + req.financials.intangible_assets,
        "total_liabilities": req.financials.short_term_liab + req.financials.long_term_liab + req.financials.contingent_liab
    })
    bank_data = session.get("raw_extracts", {}).get("bank_csv", {})
    bureau_data = session.get("raw_extracts", {}).get("bureau_json", {"bureau_score": req.financials.bureau_score})

    # 2. Compute financial ratios (Feature Engineering)
    # Total collateral from list (Stage 1)
    total_col_val = sum(c.get("value", 0) for c in req.collateral_list)
    
    features = compute_financial_ratios(
        financials=financials,
        bank_data=bank_data,
        bureau_data=bureau_data,
        collateral_value=total_col_val,
        loan_amount=req.facility.amount
    )

    # Fetch additional data from Databricks Lakehouse
    gst_data = fetch_gst_from_databricks(str(req.analysis_id))
    features.update(gst_data)

    # Add categorical metadata for audit/display
    features["company_name"] = req.customer.name
    features["industry"] = req.customer.industry

    save_features(req.analysis_id, features)

    # 2.5 Structured Financials LLM Simulator (Revenue, Cash Flow, Red Flags)
    from modules.llm_financial_analyzer import analyze_structured_financials
    features["financial_llm_assessment"] = analyze_structured_financials(features)
    
    # 2.6 Unstructured Document Phase 3 Analyzer (Litigation, Liabilities, Defaults)
    from modules.llm_risk_analyzer import analyze_unstructured_risks
    
    # Attempt to pull RAW TEXT directly from PDF/OCR parser if available, otherwise fallback to SWOT input
    raw_document_text = financials.get("raw_text", "")
    if not str(raw_document_text).strip():
         raw_document_text = req.writeup.swot or req.writeup.business_overview or req.customer.name
         
    features["unstructured_risk_assessment"] = analyze_unstructured_risks(raw_document_text)

    # 3. Simulate Web-Scale Research
    from modules.web_research import simulate_web_research, summarize_company_profile
    
    web_research_data = simulate_web_research(
        company_name=req.customer.name,
        industry=req.customer.industry,
        revenue=features.get("revenue", 0),
        bureau_score=features.get("bureau_score", 700),
        site_visit_insights=req.writeup.business_overview, # Proxy SWOT/Writeup to web-scale context
        management_interview_notes=req.writeup.swot
    )
    
    # 3.2 External Web Intelligence Simulator (Phase 4)
    from modules.llm_external_analyzer import analyze_external_intelligence
    web_research_data["external_intelligence_summary"] = analyze_external_intelligence(web_research_data)
    
    # 3.5 LLM Simulator (Indian Corporate Credit Analyst)
    company_profile_summary = summarize_company_profile(
        req.writeup.business_overview or f"{req.customer.name} operates in {req.customer.industry}"
    )

    # 3.6 Phase 5 Qualitative Due Diligence (Senior Credit Manager)
    from modules.llm_qualitative_analyzer import analyze_qualitative_inputs
    features["qualitative_assessment"] = analyze_qualitative_inputs(
        site_visit_notes=req.writeup.business_overview,
        management_notes=req.writeup.swot
    )

    # 4. ML Inference
    try:
        pd_score, scaled_features = predict_pd(features)
        recommended_limit = predict_limit(features)
        shap_explanation = get_shap_explanation(features)
        model_metrics = get_model_metrics()
    except Exception as e:
        # Fallback if models aren't trained yet (shouldn't happen in demo)
        print(f"ML Error: {e}")
        pd_score = 0.15
        recommended_limit = req.facility.amount * 0.8
        shap_explanation = {"top_5_factors": []}
        model_metrics = {}

    # Calculate base risk premium and add impact of qualitative qualitative insights
    primary_insights_bps = web_research_data.get("primary_insights", {}).get("impact_bps", 0)
    risk_premium = compute_risk_premium(
        pd_score=pd_score,
        industry_risk=web_research_data.get("industry_macro", {}).get("risk_factor", 0.3),
        collateral_coverage=features.get("collateral_coverage", 1.0)
    )
    
    # Policy Exception penalty
    if req.writeup.policy_exceptions:
        primary_insights_bps += 100 # Add massive premium penalty for policy exceptions
        
    risk_premium["total_rate_bps"] += primary_insights_bps
    risk_premium["total_rate"] = risk_premium["total_rate_bps"] / 10000.0

    # 5. Stress Testing
    stress_results = run_stress_test(features, pd_score)

    # 6. Risk Synthesis & Capital Impact
    composite_risk = compute_composite_risk(pd_score, features, web_research_data, stress_results)
    
    # Adjust composite based on Stage 2 Concentation Exposure Risks
    exposure_penalty = 0
    if req.exposure.industry == "High" or req.exposure.geography == "High":
        exposure_penalty = 15
    composite_risk["composite_score"] = min(100, composite_risk.get("composite_score", 50) + exposure_penalty)
    
    capital_impact = compute_capital_impact(
        loan_amount=req.facility.amount,
        pd_score=pd_score,
        composite_score=composite_risk.get("composite_score", 50)
    )

    # 7. Decision Engine
    decision_result = make_decision(
        pd_score=pd_score,
        composite_risk=composite_risk,
        web_research=web_research_data,
        features=features,
        shap_explanation=shap_explanation,
        recommended_limit=recommended_limit,
        risk_premium=risk_premium
    )
    
    # 7.5 Inject summarized company profile directly into decision payload for CAM routing
    decision_result["company_summary"] = company_profile_summary

    # 7.6 Phase 6 - Five Cs of Credit Synthesis
    from modules.llm_five_c_analyzer import synthesize_five_cs
    decision_result["five_c_synthesis"] = synthesize_five_cs(features, web_research_data)

    # 8. Governance & Audit Trail
    audit_trail = generate_audit_trail(
        analysis_id=req.analysis_id,
        company_name=req.customer.name,
        industry=req.customer.industry,
        decision_result=decision_result,
        features=features,
        web_research=web_research_data,
        stress_test=stress_results
    )

    # Bundle final response
    full_result = {
        "analysis_id": req.analysis_id,
        "company_name": req.customer.name,
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
        "workflow_state": req.approval.dict() # Propagate Stage 3 state
    }

    # Store in memory/DB for CAM generation later (isolated by tenant)
    tenant_db[req.analysis_id]["full_result"] = full_result
    tenant_db[req.analysis_id]["status"] = "COMPLETED"

    # Async Webhook Dispatch for B2B Clients
    if tenant.get("webhook_url"):
        background_tasks.add_task(
            dispatch_webhook,
            tenant["webhook_url"],
            req.analysis_id,
            decision_result.get("decision", "PENDING"),
            decision_result.get("summary", {}).get("recommended_limit", 0)
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

# --- DRAFTS PERSISTENCE (LOS Feature) ---
@router.post("/drafts/save")
async def save_los_draft(req: AnalyzeRequest, tenant: Dict = Depends(get_tenant)):
    """Save an in-progress Credit Proposal Draft to the Datastore (Mocked to Memory here)."""
    tenant_id = tenant["tenant_id"]
    if tenant_id not in ANALYSIS_DB:
        ANALYSIS_DB[tenant_id] = {}
        
    ANALYSIS_DB[tenant_id][req.analysis_id] = {
        "draft_payload": req.dict(),
        "status": "DRAFT"
    }
    return {"status": "success", "message": "Draft saved securely.", "analysis_id": req.analysis_id}

@router.get("/drafts/load/{analysis_id}")
async def load_los_draft(analysis_id: str, tenant: Dict = Depends(get_tenant)):
    """Load an in-progress Credit Proposal Draft."""
    tenant_id = tenant["tenant_id"]
    session = ANALYSIS_DB.get(tenant_id, {}).get(analysis_id)
    if not session or "draft_payload" not in session:
        raise HTTPException(status_code=404, detail="Draft not found")
        
    return {"status": "success", "draft": session["draft_payload"]}

@router.get("/drafts/all")
async def get_all_drafts(tenant: Dict = Depends(get_tenant)):
    """Return all drafts for the specific tenant to show on the Portfolio page."""
    tenant_id = tenant["tenant_id"]
    drafts_list = []
    
    # Iterate through DB mock looking for DRAFT statuses
    for an_id, session_data in ANALYSIS_DB.get(tenant_id, {}).items():
        if session_data.get("status") == "DRAFT":
            drafts_list.append({
                "analysis_id": an_id,
                "company_name": session_data.get("draft_payload", {}).get("customer", {}).get("name", "Unnamed Draft"),
                "status": "DRAFT",
                # Extract some metric to preview
                "limit_recommendation": session_data.get("draft_payload", {}).get("facility", {}).get("amount", 0)
            })
            
    return {"drafts": drafts_list}
