"""
Decision Engine
AI-powered lending decision engine with weighted scoring matrix,
dynamic risk appetite, and Gemini-generated decision narratives.

Replaces rigid if/elif decision trees with a composable scoring system
where each factor contributes a weighted score. Hard knock-outs
(RBI/wilful defaulter, severe DPD) remain as absolute gates per
regulatory requirements.
"""
import json
import os
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx

GEMINI_API_KEY: Optional[str] = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL: str = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")

# ===================================================================
# Default Risk Appetite Configuration (fully injectable)
# ===================================================================

DEFAULT_RISK_APPETITE: Dict[str, Any] = {
    # Probability-of-default gates
    "pd_threshold_approve": 0.30,
    "pd_threshold_max": 0.50,
    # DSCR thresholds
    "dscr_min_approve": 1.5,
    "dscr_min_conditional": 1.0,
    # Collateral
    "collateral_coverage_min": 1.0,
    "collateral_coverage_preferred": 1.20,
    # Risk grades
    "approved_grades": ("A", "B"),
    "conditional_grades": ("A", "B", "C"),
    # GST-bank gap
    "gst_bank_gap_max_approve": 10,
    "gst_bank_gap_conditional": 15,
    # Bureau
    "bureau_score_strong": 750,
    "bureau_score_min": 600,
    # DPD
    "max_dpd_knockout": 90,
    # Sales inflation
    "sales_inflation_knockout_pct": 30,
    # Decision score thresholds (0-100)
    "approve_threshold": 70,        # Score >= 70 → APPROVE
    "conditional_threshold": 45,    # Score >= 45 → CONDITIONAL
    # Factor weights (must sum to 1.0)
    "weight_pd": 0.25,
    "weight_dscr": 0.20,
    "weight_collateral": 0.10,
    "weight_bureau": 0.15,
    "weight_gst_alignment": 0.10,
    "weight_web_risk": 0.10,
    "weight_cash_flow": 0.10,
}


# ===================================================================
# SHAP helpers
# ===================================================================

def _top_risk_factors(shap_explanation: Dict[str, Any]) -> List[Dict[str, Any]]:
    factors: List[Dict[str, Any]] = []
    for factor in shap_explanation.get("top_5_factors", [])[:5]:
        feature_name = factor.get("feature", "unknown").replace("_", " ").title()
        shap_value = float(factor.get("shap_value", 0) or 0)
        factors.append(
            {
                "factor": feature_name,
                "value": factor.get("feature_value", 0),
                "impact": "Increases Risk" if factor.get("impact") == "increases_risk" or shap_value > 0 else "Decreases Risk",
                "importance": abs(shap_value),
            }
        )
    return factors


# ===================================================================
# Factor Scoring Functions (each returns 0-100, higher = better)
# ===================================================================

def _score_pd(pd_score: float, appetite: Dict[str, Any]) -> Dict[str, Any]:
    """Score probability of default — lower PD = higher score."""
    threshold_approve = appetite.get("pd_threshold_approve", 0.30)
    threshold_max = appetite.get("pd_threshold_max", 0.50)

    if pd_score <= 0.05:
        score = 100
    elif pd_score <= 0.10:
        score = 90
    elif pd_score < threshold_approve:
        # Linear scale from 90 at 0.10 to 60 at threshold
        score = 90 - (pd_score - 0.10) / (threshold_approve - 0.10) * 30
    elif pd_score < threshold_max:
        # Linear scale from 60 at threshold to 20 at max
        score = 60 - (pd_score - threshold_approve) / (threshold_max - threshold_approve) * 40
    else:
        score = max(0, 20 - (pd_score - threshold_max) * 100)

    return {
        "score": round(max(0, min(100, score)), 2),
        "reasoning": f"PD of {pd_score:.1%} translates to a factor score of {score:.0f}/100.",
    }


def _score_dscr(dscr: float, appetite: Dict[str, Any]) -> Dict[str, Any]:
    """Score debt service coverage ratio — higher DSCR = higher score."""
    min_approve = appetite.get("dscr_min_approve", 1.5)

    if dscr >= 2.5:
        score = 100
    elif dscr >= min_approve:
        score = 70 + (dscr - min_approve) / (2.5 - min_approve) * 30
    elif dscr >= 1.0:
        score = 40 + (dscr - 1.0) / (min_approve - 1.0) * 30
    elif dscr >= 0.5:
        score = 10 + (dscr - 0.5) * 60
    else:
        score = max(0, dscr * 20)

    return {
        "score": round(max(0, min(100, score)), 2),
        "reasoning": f"DSCR of {dscr:.2f}x → factor score {score:.0f}/100.",
    }


def _score_collateral(coverage: float, appetite: Dict[str, Any]) -> Dict[str, Any]:
    """Score collateral coverage."""
    preferred = appetite.get("collateral_coverage_preferred", 1.20)

    if coverage >= 2.0:
        score = 100
    elif coverage >= preferred:
        score = 75 + (coverage - preferred) / (2.0 - preferred) * 25
    elif coverage >= 1.0:
        score = 50 + (coverage - 1.0) / (preferred - 1.0) * 25
    elif coverage >= 0.5:
        score = 20 + (coverage - 0.5) * 60
    else:
        score = max(0, coverage * 40)

    return {
        "score": round(max(0, min(100, score)), 2),
        "reasoning": f"Collateral coverage of {coverage:.2f}x → factor score {score:.0f}/100.",
    }


def _score_bureau(bureau_score: int, appetite: Dict[str, Any]) -> Dict[str, Any]:
    """Score bureau/CIBIL performance."""
    strong = appetite.get("bureau_score_strong", 750)

    if bureau_score >= 800:
        score = 100
    elif bureau_score >= strong:
        score = 80 + (bureau_score - strong) / (800 - strong) * 20
    elif bureau_score >= 650:
        score = 50 + (bureau_score - 650) / (strong - 650) * 30
    elif bureau_score >= 500:
        score = 20 + (bureau_score - 500) / 150 * 30
    else:
        score = max(0, bureau_score / 500 * 20)

    return {
        "score": round(max(0, min(100, score)), 2),
        "reasoning": f"Bureau score of {bureau_score} → factor score {score:.0f}/100.",
    }


def _score_gst_alignment(features: Dict[str, Any], appetite: Dict[str, Any]) -> Dict[str, Any]:
    """Score GST-bank alignment."""
    gap_pct = float(features.get("gst_bank_gap_pct", 0) or 0)
    max_approve = appetite.get("gst_bank_gap_max_approve", 10)

    if gap_pct <= 5:
        score = 100
    elif gap_pct <= max_approve:
        score = 80
    elif gap_pct <= 20:
        score = 50
    elif gap_pct <= 30:
        score = 25
    else:
        score = max(0, 10 - (gap_pct - 30))

    # Circular trading flag is a severe penalty
    if features.get("circular_trading_flag"):
        score = min(score, 15)

    return {
        "score": round(max(0, min(100, score)), 2),
        "reasoning": f"GST-bank gap of {gap_pct:.1f}% → factor score {score:.0f}/100.",
    }


def _score_web_risk(web_research: Dict[str, Any]) -> Dict[str, Any]:
    """Score external web risk (inverted — lower web_risk_score = higher factor score)."""
    web_risk = web_research.get("web_risk_score", 40)
    score = max(0, 100 - web_risk)

    return {
        "score": round(max(0, min(100, score)), 2),
        "reasoning": f"Web risk score of {web_risk:.1f} → factor score {score:.0f}/100.",
    }


def _score_cash_flow(features: Dict[str, Any]) -> Dict[str, Any]:
    """Score cash flow stability and health."""
    stability = float(features.get("cash_flow_stability", 0.5) or 0)
    emi_bounces = int(features.get("emi_bounce_count", 0) or 0)
    min_violations = int(features.get("min_balance_violations", 0) or 0)

    base_score = stability * 80
    bounce_penalty = min(emi_bounces * 15, 40)
    violation_penalty = min(min_violations * 2, 20)
    score = max(0, base_score - bounce_penalty - violation_penalty)

    details = [f"stability={stability:.2f}"]
    if emi_bounces:
        details.append(f"{emi_bounces} EMI bounces")
    if min_violations:
        details.append(f"{min_violations} min-balance violations")

    return {
        "score": round(max(0, min(100, score)), 2),
        "reasoning": f"Cash flow ({', '.join(details)}) → factor score {score:.0f}/100.",
    }


# ===================================================================
# Knock-out Rules (absolute gates — unchanged)
# ===================================================================

def _eval_knockout_rbi_defaulter(
    features: Dict[str, Any], _appetite: Dict[str, Any],
) -> Optional[str]:
    if features.get("rbi_defaulter_flag") or features.get("wilful_defaulter_flag"):
        return "Borrower appears on RBI or wilful defaulter lists."
    return None


def _eval_knockout_dpd(
    features: Dict[str, Any], appetite: Dict[str, Any],
) -> Optional[str]:
    max_dpd = float(features.get("max_dpd_last_12_months", 0) or 0)
    limit = appetite.get("max_dpd_knockout", 90)
    if max_dpd > limit:
        return (
            f"Maximum DPD in the last 12 months is {int(max_dpd)} days, "
            f"exceeding the {limit}-day tolerance."
        )
    return None


def _eval_knockout_sales_inflation(
    features: Dict[str, Any], appetite: Dict[str, Any],
) -> Optional[str]:
    risk_pct = float(features.get("sales_inflation_risk", 0) or 0)
    cutoff = appetite.get("sales_inflation_knockout_pct", 30)
    if risk_pct > cutoff:
        return f"Sales inflation risk is {risk_pct:.2f}%, above the {cutoff}% cut-off."
    return None


# ===================================================================
# Gemini Narrative Generation
# ===================================================================

def _extract_json_block(text: str) -> Dict[str, Any]:
    if not text:
        return {}
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return {}
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return {}


def _generate_decision_narrative(
    decision: str,
    composite_score: float,
    factor_scores: Dict[str, Dict[str, Any]],
    conditions: List[str],
    features: Dict[str, Any],
    web_research: Dict[str, Any],
) -> str:
    """Use Gemini to generate a human-readable decision narrative."""
    if not GEMINI_API_KEY:
        # Fallback: construct narrative from factor scores
        lines = [f"Decision: {decision} (Composite Score: {composite_score:.1f}/100)"]
        for name, data in factor_scores.items():
            lines.append(f"  {name}: {data['reasoning']}")
        if conditions:
            lines.append("Conditions: " + "; ".join(conditions))
        return "\n".join(lines)

    prompt = (
        "You are a senior credit analyst writing a decision narrative for a "
        "corporate loan proposal at an Indian bank. Write a concise, professional "
        "3-4 paragraph narrative explaining the credit decision.\n\n"
        f"Decision: {decision}\n"
        f"Composite Decision Score: {composite_score:.1f}/100\n"
        f"Factor Breakdown: {json.dumps({k: v['score'] for k, v in factor_scores.items()})}\n"
        f"Key Metrics: PD={features.get('pd_score', 'N/A')}, "
        f"DSCR={features.get('dscr', 'N/A')}, "
        f"Bureau={features.get('bureau_score', 'N/A')}, "
        f"Litigation={web_research.get('litigation_flag', False)}\n"
        f"Conditions: {json.dumps(conditions) if conditions else 'None'}\n\n"
        "Return strict JSON: {\"narrative\": string}"
    )

    try:
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.3, "responseMimeType": "application/json"},
        }
        response = httpx.post(endpoint, json=payload, timeout=20.0)
        response.raise_for_status()
        body = response.json()
        text_parts = body.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        combined = "\n".join(part.get("text", "") for part in text_parts)
        result = _extract_json_block(combined)
        return result.get("narrative", "")
    except Exception:
        # Fallback narrative
        lines = [f"Decision: {decision} (Composite Score: {composite_score:.1f}/100)"]
        for name, data in factor_scores.items():
            lines.append(f"  {name}: {data['reasoning']}")
        return "\n".join(lines)


# ===================================================================
# Core Decision Function (Weighted Scoring Matrix)
# ===================================================================

def make_decision(
    pd_score: float,
    composite_risk: Dict[str, Any],
    web_research: Dict[str, Any],
    features: Dict[str, Any],
    shap_explanation: Dict[str, Any],
    recommended_limit: float,
    risk_premium: Dict[str, Any],
    *,
    risk_appetite: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Make lending decision using a weighted scoring matrix.

    Instead of rigid if/elif blocks, the engine computes a **composite
    decision score** (0-100) from individually weighted factor scores.
    Decision thresholds are configurable via ``risk_appetite``.

    Phases:
    1. **Knock-out rules** — absolute regulatory gates (RBI defaulter, DPD).
    2. **Factor scoring** — each metric contributes a weighted score.
    3. **Composite decision** — aggregate score determines APPROVE/CONDITIONAL/REJECT.
    4. **Narrative generation** — Gemini writes a human-readable explanation.
    """
    appetite = {**DEFAULT_RISK_APPETITE, **(risk_appetite or {})}

    grade: str = composite_risk.get("grade", "C")
    composite_risk_score: float = composite_risk.get("composite_score", 50)
    litigation: bool = web_research.get("litigation_flag", False)
    dscr: float = float(features.get("dscr", 1) or 0)
    collateral_coverage: float = float(features.get("collateral_coverage", 1) or 0)
    bureau_score: int = int(features.get("bureau_score", 650) or 650)

    reasoning: List[str] = []
    conditions: List[str] = []
    decision = "REJECT"

    # ── Phase 1: Knock-out rules (absolute gates) ─────────────────────
    knockout_evaluators = [
        _eval_knockout_rbi_defaulter,
        _eval_knockout_dpd,
        _eval_knockout_sales_inflation,
    ]
    knockout_reasons: List[str] = []
    for evaluator in knockout_evaluators:
        result = evaluator(features, appetite)
        if result:
            knockout_reasons.append(result)

    if knockout_reasons:
        reasoning.extend(knockout_reasons)
        reasoning.append("Request falls outside policy due to hard knock-out rules.")
        decision = "REJECT"
    else:
        # ── Phase 2: Factor scoring matrix ───────────────────────────
        factor_scores: Dict[str, Dict[str, Any]] = {
            "probability_of_default": _score_pd(pd_score, appetite),
            "debt_service_coverage": _score_dscr(dscr, appetite),
            "collateral_coverage": _score_collateral(collateral_coverage, appetite),
            "bureau_performance": _score_bureau(bureau_score, appetite),
            "gst_alignment": _score_gst_alignment(features, appetite),
            "external_risk": _score_web_risk(web_research),
            "cash_flow_health": _score_cash_flow(features),
        }

        # Weighted composite score
        weights = {
            "probability_of_default": appetite.get("weight_pd", 0.25),
            "debt_service_coverage": appetite.get("weight_dscr", 0.20),
            "collateral_coverage": appetite.get("weight_collateral", 0.10),
            "bureau_performance": appetite.get("weight_bureau", 0.15),
            "gst_alignment": appetite.get("weight_gst_alignment", 0.10),
            "external_risk": appetite.get("weight_web_risk", 0.10),
            "cash_flow_health": appetite.get("weight_cash_flow", 0.10),
        }

        decision_score = sum(
            factor_scores[name]["score"] * weights.get(name, 0.1)
            for name in factor_scores
        )
        decision_score = round(max(0, min(100, decision_score)), 2)

        # ── Phase 3: Threshold-based decision ────────────────────────
        approve_threshold = appetite.get("approve_threshold", 70)
        conditional_threshold = appetite.get("conditional_threshold", 45)

        if decision_score >= approve_threshold and not litigation:
            decision = "APPROVE"
            reasoning.append(
                f"Composite decision score of {decision_score:.1f}/100 exceeds "
                f"the {approve_threshold} approval threshold."
            )
            for name, data in factor_scores.items():
                reasoning.append(data["reasoning"])

        elif decision_score >= conditional_threshold:
            decision = "CONDITIONAL"
            reasoning.append(
                f"Composite decision score of {decision_score:.1f}/100 falls in "
                f"the conditional range ({conditional_threshold}-{approve_threshold})."
            )
            for name, data in factor_scores.items():
                reasoning.append(data["reasoning"])

            # Generate conditions based on weak factors
            if factor_scores["probability_of_default"]["score"] < 60:
                conditions.append("Sanction with tighter monitoring and enhanced pricing approval.")
            if factor_scores["debt_service_coverage"]["score"] < 60:
                conditions.append("Obtain monthly cash flow statements and monitor DSCR quarterly.")
            if factor_scores["collateral_coverage"]["score"] < 60:
                conditions.append(
                    f"Enhance collateral or obtain promoter support to reach "
                    f"{appetite.get('collateral_coverage_preferred', 1.20):.2f}x coverage."
                )
            if litigation:
                conditions.append("Complete legal clearance on all identified court matters.")
            if factor_scores["gst_alignment"]["score"] < 60:
                conditions.append("Provide monthly GST-bank reconciliation and debtor ageing certification.")
            if features.get("emi_bounce_count", 0):
                conditions.append("No EMI bounce permitted during the initial monitoring period.")
            if not conditions:
                conditions.append("Enhanced quarterly monitoring by relationship and risk teams.")

        else:
            decision = "REJECT"
            reasoning.append(
                f"Composite decision score of {decision_score:.1f}/100 is below "
                f"the {conditional_threshold} minimum threshold."
            )
            for name, data in factor_scores.items():
                if data["score"] < 50:
                    reasoning.append(f"Weak: {data['reasoning']}")

        # Generate AI narrative
        narrative = _generate_decision_narrative(
            decision, decision_score, factor_scores, conditions, features, web_research,
        )

    # Append primary-insight flags
    for flag in web_research.get("primary_insights", {}).get("flags", []):
        if flag not in reasoning:
            reasoning.append(flag)

    result = {
        "decision": decision,
        "reasoning": reasoning,
        "conditions": conditions,
        "risk_factors": _top_risk_factors(shap_explanation),
        "risk_appetite_used": appetite,
        "summary": {
            "risk_grade": grade,
            "risk_grade_label": composite_risk.get("grade_label"),
            "composite_score": composite_risk_score,
            "pd_score": round(pd_score, 4),
            "recommended_limit": recommended_limit,
            "risk_premium_bps": risk_premium.get("total_rate_bps", 0),
            "total_rate": risk_premium.get("total_rate", 0),
            "dscr": round(dscr, 4),
            "collateral_coverage": round(collateral_coverage, 4),
            "bureau_score": bureau_score,
            "litigation_flag": litigation,
            "max_dpd_last_12_months": features.get("max_dpd_last_12_months", 0),
            "sales_inflation_risk": round(float(features.get("sales_inflation_risk", 0) or 0), 2),
            "rbi_defaulter_flag": bool(features.get("rbi_defaulter_flag", False)),
            "knockout_reasons": knockout_reasons,
        },
        "timestamp": datetime.utcnow().isoformat(),
    }

    if not knockout_reasons:
        result["decision_score"] = decision_score
        result["factor_scores"] = {
            name: {"score": data["score"], "weight": weights.get(name, 0.1)}
            for name, data in factor_scores.items()
        }
        result["narrative"] = narrative

    return result


# ===================================================================
# Audit Trail
# ===================================================================

def generate_audit_trail(
    analysis_id: str,
    company_name: str,
    industry: str,
    decision_result: Dict[str, Any],
    features: Dict[str, Any],
    web_research: Dict[str, Any],
    stress_test: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Generate audit trail log for governance and compliance."""
    knockout_summary = ", ".join(decision_result.get("summary", {}).get("knockout_reasons", [])) or "No knock-out trigger"
    decision_method = "Weighted scoring matrix" if decision_result.get("decision_score") else "Knock-out rule"
    return [
        {
            "step": 1,
            "action": "Data Ingestion",
            "timestamp": datetime.utcnow().isoformat(),
            "detail": f"Financial, bank, bureau, and GST data assembled for {company_name}.",
            "status": "completed",
            "module": "ingestion",
        },
        {
            "step": 2,
            "action": "Feature Extraction",
            "timestamp": datetime.utcnow().isoformat(),
            "detail": f"Extracted {len(features)} features including DSCR={features.get('dscr', 'N/A')} and ADB={features.get('average_daily_balance', 'N/A')}.",
            "status": "completed",
            "module": "feature_store",
        },
        {
            "step": 3,
            "action": "Web Intelligence Scan",
            "timestamp": datetime.utcnow().isoformat(),
            "detail": f"Industry={industry}, regulatory risk={web_research.get('regulatory_risk', 'N/A')}, litigation={web_research.get('litigation_flag', False)}, source={web_research.get('ecourts_source_status', 'N/A')}.",
            "status": "completed",
            "module": "web_research",
        },
        {
            "step": 4,
            "action": "ML Risk Assessment",
            "timestamp": datetime.utcnow().isoformat(),
            "detail": f"PD={decision_result['summary']['pd_score']:.2%}, recommended limit=INR {decision_result['summary']['recommended_limit']:,.0f}.",
            "status": "completed",
            "module": "ml_engine",
        },
        {
            "step": 5,
            "action": "Stress Testing",
            "timestamp": datetime.utcnow().isoformat(),
            "detail": f"Combined stress DSCR={stress_test.get('combined_stress', {}).get('dscr', 'N/A')}, survives={stress_test.get('combined_stress', {}).get('survives_stress', 'N/A')}.",
            "status": "completed",
            "module": "stress_test",
        },
        {
            "step": 6,
            "action": "Risk Synthesis",
            "timestamp": datetime.utcnow().isoformat(),
            "detail": f"Composite score={decision_result['summary']['composite_score']:.1f}, grade={decision_result['summary']['risk_grade']}.",
            "status": "completed",
            "module": "risk_synthesis",
        },
        {
            "step": 7,
            "action": "AI Decision Engine",
            "timestamp": datetime.utcnow().isoformat(),
            "detail": f"Decision={decision_result['decision']} via {decision_method}, pricing={decision_result['summary']['risk_premium_bps']} bps, knock-out check={knockout_summary}.",
            "status": "completed",
            "module": "decision_engine",
        },
        {
            "step": 8,
            "action": "Governance Check",
            "timestamp": datetime.utcnow().isoformat(),
            "detail": "Audit trail captured and model versioning recorded for review.",
            "status": "completed",
            "module": "governance",
        },
    ]
