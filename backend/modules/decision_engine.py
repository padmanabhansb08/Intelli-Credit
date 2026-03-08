"""
Decision Engine
Applies lending decision rules with hard knock-out conditions and SHAP-based explainability.
"""
from datetime import datetime
from typing import Any, Dict, List


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


def _knockout_reasons(features: Dict[str, Any]) -> List[str]:
    reasons: List[str] = []
    if features.get("rbi_defaulter_flag") or features.get("wilful_defaulter_flag"):
        reasons.append("Borrower appears on RBI or wilful defaulter lists.")
    if float(features.get("max_dpd_last_12_months", 0) or 0) > 90:
        reasons.append(
            f"Maximum DPD in the last 12 months is {features.get('max_dpd_last_12_months', 0)} days, exceeding the 90-day tolerance."
        )
    if float(features.get("sales_inflation_risk", 0) or 0) > 30:
        reasons.append(
            f"Sales inflation risk is {float(features.get('sales_inflation_risk', 0)):.2f}%, above the 30% cut-off."
        )
    return reasons


def make_decision(
    pd_score: float,
    composite_risk: Dict[str, Any],
    web_research: Dict[str, Any],
    features: Dict[str, Any],
    shap_explanation: Dict[str, Any],
    recommended_limit: float,
    risk_premium: Dict[str, Any],
) -> Dict[str, Any]:
    """Make lending decision: APPROVE, CONDITIONAL, or REJECT."""
    grade = composite_risk.get("grade", "C")
    composite_score = composite_risk.get("composite_score", 50)
    litigation = web_research.get("litigation_flag", False)
    dscr = float(features.get("dscr", 1) or 0)
    collateral_coverage = float(features.get("collateral_coverage", 1) or 0)
    bureau_score = int(features.get("bureau_score", 700) or 700)
    knockout_reasons = _knockout_reasons(features)

    reasoning: List[str] = []
    conditions: List[str] = []
    decision = "REJECT"

    if knockout_reasons:
        reasoning.extend(knockout_reasons)
        reasoning.append("Request falls outside policy due to hard knock-out rules.")
    elif grade in ("A", "B") and pd_score < 0.30 and not litigation and dscr >= 1.5 and collateral_coverage >= 1.0:
        decision = "APPROVE"
        reasoning.append(f"Risk grade {grade} ({composite_risk.get('grade_label')}) is within approved risk appetite.")
        reasoning.append(f"Probability of default at {pd_score:.1%} is below the 30% threshold.")
        reasoning.append(f"DSCR of {dscr:.2f}x supports debt servicing under base case assumptions.")
        if bureau_score >= 750:
            reasoning.append(f"Bureau score of {bureau_score} indicates strong repayment conduct.")
        if features.get("gst_bank_gap_pct", 0) <= 10:
            reasoning.append("GST turnover and bank inflows are broadly aligned.")
    elif grade in ("A", "B", "C") and pd_score < 0.50:
        decision = "CONDITIONAL"
        reasoning.append(f"Risk grade {grade} requires structure enhancement and tighter monitoring.")
        if litigation:
            reasoning.append("Active litigation or court references require legal review before disbursement.")
            conditions.append("Complete legal clearance on all identified court matters.")
        if pd_score >= 0.30:
            reasoning.append(f"Probability of default at {pd_score:.1%} is elevated for an unconditional approval.")
            conditions.append("Sanction with tighter monitoring and enhanced pricing approval.")
        if dscr < 1.5:
            reasoning.append(f"DSCR of {dscr:.2f}x is below policy comfort.")
            conditions.append("Obtain monthly cash flow statements and monitor DSCR quarterly.")
        if collateral_coverage < 1.2:
            reasoning.append(f"Collateral coverage of {collateral_coverage:.2f}x is below the preferred 1.20x level.")
            conditions.append("Enhance collateral or obtain promoter support to reach 1.20x coverage.")
        if float(features.get("gst_bank_gap_pct", 0) or 0) > 15:
            reasoning.append("GST revenue does not sufficiently map to bank inflows.")
            conditions.append("Provide monthly GST-bank reconciliation and debtor ageing certification.")
        if features.get("emi_bounce_count", 0):
            reasoning.append(f"Observed {features.get('emi_bounce_count', 0)} EMI-related bounces in bank statement analysis.")
            conditions.append("No EMI bounce permitted during the initial monitoring period.")
        if not conditions:
            conditions.append("Enhanced quarterly monitoring by relationship and risk teams.")
    else:
        reasoning.append(f"Risk grade {grade} ({composite_risk.get('grade_label')}) exceeds credit appetite.")
        if pd_score >= 0.50:
            reasoning.append(f"Probability of default at {pd_score:.1%} is unacceptably high.")
        if dscr < 1.0:
            reasoning.append(f"DSCR of {dscr:.2f}x indicates inadequate debt servicing capacity.")
        if litigation:
            reasoning.append("External litigation exposure remains unresolved.")
        if collateral_coverage < 1.0:
            reasoning.append(f"Collateral coverage of {collateral_coverage:.2f}x is below minimum support expectations.")

    for flag in web_research.get("primary_insights", {}).get("flags", []):
        if flag not in reasoning:
            reasoning.append(flag)

    return {
        "decision": decision,
        "reasoning": reasoning,
        "conditions": conditions,
        "risk_factors": _top_risk_factors(shap_explanation),
        "summary": {
            "risk_grade": grade,
            "risk_grade_label": composite_risk.get("grade_label"),
            "composite_score": composite_score,
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
            "detail": f"Industry={industry}, regulatory risk={web_research.get('regulatory_risk', 'N/A')}, litigation={web_research.get('litigation_flag', False)}.",
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
            "action": "Decision Engine",
            "timestamp": datetime.utcnow().isoformat(),
            "detail": f"Decision={decision_result['decision']}, pricing={decision_result['summary']['risk_premium_bps']} bps, knock-out check={knockout_summary}.",
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
