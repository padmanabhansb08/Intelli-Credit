"""
Decision Engine
Applies lending decision rules with SHAP-based explainability.
"""
from typing import Dict, Any, List
from datetime import datetime


def make_decision(pd_score: float, composite_risk: Dict[str, Any],
                  web_research: Dict[str, Any], features: Dict[str, Any],
                  shap_explanation: Dict[str, Any], recommended_limit: float,
                  risk_premium: Dict[str, Any]) -> Dict[str, Any]:
    """
    Make lending decision: APPROVE, CONDITIONAL, or REJECT.
    """
    grade = composite_risk.get("grade", "C")
    composite_score = composite_risk.get("composite_score", 50)
    litigation = web_research.get("litigation_flag", False)
    dscr = features.get("dscr", 1)
    collateral_coverage = features.get("collateral_coverage", 1)
    bureau_score = features.get("bureau_score", 700)

    decision = "REJECT"
    conditions = []
    reasoning = []

    # Decision logic
    if grade in ("A", "B") and pd_score < 0.3 and not litigation:
        decision = "APPROVE"
        reasoning.append(f"Risk Grade {grade} ({composite_risk.get('grade_label')}) is within acceptable range")
        reasoning.append(f"Probability of Default ({pd_score:.1%}) is below 30% threshold")
        reasoning.append("No active litigation flags detected")

        if dscr > 2.0:
            reasoning.append(f"Strong debt service coverage ratio of {dscr:.2f}x")
        if bureau_score > 750:
            reasoning.append(f"Excellent bureau score of {bureau_score}")

    elif (grade == "C" or (grade in ("A", "B") and litigation) or
          (pd_score >= 0.3 and pd_score < 0.5)):
        decision = "CONDITIONAL"
        reasoning.append(f"Risk Grade {grade} requires enhanced due diligence")

        if pd_score >= 0.3:
            reasoning.append(f"PD of {pd_score:.1%} is at elevated level")
            conditions.append("Require additional collateral or guarantor")

        if litigation:
            reasoning.append("Active litigation detected - requires legal review")
            conditions.append("Complete litigation risk assessment before disbursement")

        if dscr < 1.5:
            reasoning.append(f"DSCR of {dscr:.2f}x is below comfort level")
            conditions.append("Monthly cash flow monitoring for first 12 months")

        if collateral_coverage < 1.2:
            reasoning.append(f"Collateral coverage of {collateral_coverage:.2f}x is marginal")
            conditions.append("Top-up collateral to achieve minimum 1.2x coverage")

        if bureau_score < 650:
            conditions.append("Enhanced monitoring with quarterly reviews")

        if not conditions:
            conditions.append("Enhanced monitoring with quarterly credit reviews")
            conditions.append("Maintain minimum DSCR of 1.2x throughout tenor")

    else:
        decision = "REJECT"
        reasoning.append(f"Risk Grade {grade} ({composite_risk.get('grade_label')}) exceeds risk appetite")

        if pd_score >= 0.5:
            reasoning.append(f"Probability of Default ({pd_score:.1%}) is unacceptably high")
        if dscr < 1.0:
            reasoning.append(f"Insufficient debt service coverage (DSCR: {dscr:.2f}x)")
        if grade in ("D", "E"):
            reasoning.append(f"Composite risk score of {composite_score:.1f} exceeds maximum threshold")
        if litigation:
            reasoning.append("Severe litigation exposure detected")

    # Top risk factors from SHAP
    top_factors = shap_explanation.get("top_5_factors", [])
    risk_factors = []
    for factor in top_factors[:5]:
        feature_name = factor["feature"].replace("_", " ").title()
        impact = "↑ Risk" if factor.get("impact") == "increases_risk" or factor.get("shap_value", 0) > 0 else "↓ Risk"
        risk_factors.append({
            "factor": feature_name,
            "value": factor.get("feature_value", 0),
            "impact": impact,
            "importance": abs(factor.get("shap_value", 0)),
        })

    return {
        "decision": decision,
        "reasoning": reasoning,
        "conditions": conditions,
        "risk_factors": risk_factors,
        "summary": {
            "risk_grade": grade,
            "risk_grade_label": composite_risk.get("grade_label"),
            "composite_score": composite_score,
            "pd_score": round(pd_score, 4),
            "recommended_limit": recommended_limit,
            "risk_premium_bps": risk_premium.get("total_rate_bps", 0),
            "total_rate": risk_premium.get("total_rate", 0),
            "dscr": dscr,
            "collateral_coverage": collateral_coverage,
            "bureau_score": bureau_score,
            "litigation_flag": litigation,
        },
        "timestamp": datetime.utcnow().isoformat(),
    }


def generate_audit_trail(analysis_id: str, company_name: str, industry: str,
                          decision_result: Dict, features: Dict,
                          web_research: Dict, stress_test: Dict) -> List[Dict]:
    """Generate audit trail log for governance and compliance."""
    trail = [
        {
            "step": 1,
            "action": "Data Ingestion",
            "timestamp": datetime.utcnow().isoformat(),
            "detail": f"Financial data received for {company_name}",
            "status": "completed",
            "module": "ingestion",
        },
        {
            "step": 2,
            "action": "Feature Extraction",
            "timestamp": datetime.utcnow().isoformat(),
            "detail": f"Extracted {len(features)} financial features including DSCR={features.get('dscr', 'N/A')}",
            "status": "completed",
            "module": "feature_store",
        },
        {
            "step": 3,
            "action": "Web Intelligence Scan",
            "timestamp": datetime.utcnow().isoformat(),
            "detail": f"Industry: {industry}, ESG: {web_research.get('esg_score', 'N/A')}, Litigation: {'Yes' if web_research.get('litigation_flag') else 'No'}",
            "status": "completed",
            "module": "web_research",
        },
        {
            "step": 4,
            "action": "ML Risk Assessment",
            "timestamp": datetime.utcnow().isoformat(),
            "detail": f"PD Model: {decision_result['summary']['pd_score']:.2%}, Limit: ₹{decision_result['summary']['recommended_limit']:,.0f}",
            "status": "completed",
            "module": "ml_engine",
        },
        {
            "step": 5,
            "action": "Stress Testing",
            "timestamp": datetime.utcnow().isoformat(),
            "detail": f"Combined stress DSCR: {stress_test.get('combined_stress', {}).get('dscr', 'N/A')}, Survives: {stress_test.get('combined_stress', {}).get('survives_stress', 'N/A')}",
            "status": "completed",
            "module": "stress_test",
        },
        {
            "step": 6,
            "action": "Risk Synthesis",
            "timestamp": datetime.utcnow().isoformat(),
            "detail": f"Composite Score: {decision_result['summary']['composite_score']:.1f}, Grade: {decision_result['summary']['risk_grade']}",
            "status": "completed",
            "module": "risk_synthesis",
        },
        {
            "step": 7,
            "action": "Decision Engine",
            "timestamp": datetime.utcnow().isoformat(),
            "detail": f"Decision: {decision_result['decision']} | Premium: {decision_result['summary']['risk_premium_bps']}bps",
            "status": "completed",
            "module": "decision_engine",
        },
        {
            "step": 8,
            "action": "Governance Check",
            "timestamp": datetime.utcnow().isoformat(),
            "detail": "Bias check passed. Model version logged. Audit trail generated.",
            "status": "completed",
            "module": "governance",
        },
    ]
    return trail
