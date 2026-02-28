from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, Dict, Any
import uuid
import os

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


class AnalyzeRequest(BaseModel):
    analysis_id: str
    company_name: str
    industry: str
    loan_amount_requested: float
    collateral_value: float
    bureau_score: Optional[int] = 700


    # Primary inputs from frontend Due Diligence
    site_visit_insights: Optional[str] = None
    management_interview_notes: Optional[str] = None

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    doc_type: str = Form(...)  # 'financial_pdf', 'bank_csv', 'bureau_json'
):
    """Upload and parse a document, returning a temporary analysis_id."""
    content = await file.read()
    analysis_id = str(uuid.uuid4())

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


    ANALYSIS_DB[analysis_id] = {
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
async def run_full_analysis(req: AnalyzeRequest):
    """Run the complete end-to-end credit decisioning pipeline."""
    try:
        # Load ML models on first request if not already in memory
        load_models()
    except Exception as e:
        print(f"Warning: Models not found, attempting to load later. {e}")

    # Connect and pull data for analysis id mapping
    session = ANALYSIS_DB.get(req.analysis_id, {})
    if not session:
        raise HTTPException(status_code=404, detail="Analysis ID not found. Upload data first.")

    # 1. Gather extracted data or fetch from Databricks storage
    financials = session.get("raw_extracts", {}).get("financial_pdf", {})
    bank_data = session.get("raw_extracts", {}).get("bank_csv", {})
    bureau_data = session.get("raw_extracts", {}).get("bureau_json", {"bureau_score": req.bureau_score})

    # 2. Compute financial ratios (Feature Engineering)
    features = compute_financial_ratios(
        financials=financials,
        bank_data=bank_data,
        bureau_data=bureau_data,
        collateral_value=req.collateral_value,
        loan_amount=req.loan_amount_requested
    )

    # Fetch additional data from Databricks Lakehouse
    gst_data = fetch_gst_from_databricks(str(req.analysis_id))
    features.update(gst_data)

    # Add categorical metadata for audit/display
    features["company_name"] = req.company_name
    features["industry"] = req.industry

    save_features(req.analysis_id, features)

    # 3. Simulate Web-Scale Research
    web_research_data = simulate_web_research(
        company_name=req.company_name,
        industry=req.industry,
        revenue=features.get("revenue", 0),
        bureau_score=features.get("bureau_score", 700)
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
        recommended_limit = req.loan_amount_requested * 0.8
        shap_explanation = {"top_5_factors": []}
        model_metrics = {}

    risk_premium = compute_risk_premium(
        pd_score=pd_score,
        industry_risk=web_research_data.get("industry_macro", {}).get("risk_factor", 0.3),
        collateral_coverage=features.get("collateral_coverage", 1.0)
    )

    # 5. Stress Testing
    stress_results = run_stress_test(features, pd_score)

    # 6. Risk Synthesis & Capital Impact
    composite_risk = compute_composite_risk(pd_score, features, web_research_data, stress_results)
    capital_impact = compute_capital_impact(
        loan_amount=req.loan_amount_requested,
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

    # 8. Governance & Audit Trail
    audit_trail = generate_audit_trail(
        analysis_id=req.analysis_id,
        company_name=req.company_name,
        industry=req.industry,
        decision_result=decision_result,
        features=features,
        web_research=web_research_data,
        stress_test=stress_results
    )

    # Bundle final response
    full_result = {
        "analysis_id": req.analysis_id,
        "company_name": req.company_name,
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
    }

    # Store in memory/DB for CAM generation later
    ANALYSIS_DB[req.analysis_id]["full_result"] = full_result
    ANALYSIS_DB[req.analysis_id]["status"] = "COMPLETED"

    return full_result


@router.get("/analyses")
async def get_all_analyses():
    """List all past analyses (from feature store)."""
    return {"analyses": list_analyses()}


@router.get("/metrics")
async def get_system_metrics():
    """Return model performance and bias metrics for the dashboard."""
    return get_model_metrics()
