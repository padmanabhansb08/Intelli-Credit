"""
CAM (Credit Appraisal Memo) Generator
Generates Five Cs-aligned CAM sections for underwriting review.
"""
from datetime import datetime
from typing import Any, Dict, List


def _fmt_inr(value: Any) -> str:
    try:
        return f"INR {float(value):,.0f}"
    except Exception:
        return "INR 0"


def _fmt_pct(value: Any, digits: int = 2) -> str:
    try:
        return f"{float(value):.{digits}%}"
    except Exception:
        return "0.00%"


def _fmt_num(value: Any, digits: int = 2) -> str:
    try:
        return f"{float(value):.{digits}f}"
    except Exception:
        return "0.00"


def _proposed_covenants(decision: Dict[str, Any], features: Dict[str, Any]) -> List[str]:
    covenants = list(decision.get("conditions", []))
    if features.get("dscr", 0) < 1.5:
        covenants.append("Maintain minimum DSCR of 1.20x and submit monthly cash flow statements.")
    if features.get("gst_bank_gap_pct", 0) > 15:
        covenants.append("Provide monthly GST versus bank sales reconciliation certified by management.")
    if features.get("emi_bounce_count", 0) > 0:
        covenants.append("No EMI or NACH bounce during the first 12 months post-sanction.")
    if features.get("collateral_coverage", 0) < 1.2:
        covenants.append("Top up collateral to maintain minimum 1.20x stressed coverage.")
    if not covenants:
        covenants.append("Quarterly financial reporting and annual review of sanctioned limits.")
    # Preserve order while deduplicating.
    unique: List[str] = []
    for covenant in covenants:
        if covenant not in unique:
            unique.append(covenant)
    return unique


def generate_cam_content(analysis_data: Dict[str, Any]) -> Dict[str, str]:
    """Generate CAM sections structured around the Five Cs of Credit."""
    company = analysis_data.get("company_name", "Borrower")
    industry = analysis_data.get("industry") or analysis_data.get("features", {}).get("industry", "N/A")
    decision = analysis_data.get("decision", {})
    features = analysis_data.get("features", {})
    web = analysis_data.get("web_research", {})
    stress = analysis_data.get("stress_test", {})
    risk = analysis_data.get("composite_risk", {})
    premium = analysis_data.get("risk_premium", {})
    capital_impact = analysis_data.get("capital_impact", {})
    summary = decision.get("summary", {})

    loan_amount = features.get("loan_amount_requested", 0)
    recommended_limit = summary.get("recommended_limit", 0)
    covenants = _proposed_covenants(decision, features)

    sections: Dict[str, str] = {}
    sections["executive_summary"] = (
        f"Borrower: {company}\n"
        f"Industry: {industry}\n"
        f"Requested facility: {_fmt_inr(loan_amount)}\n"
        f"Recommended limit: {_fmt_inr(recommended_limit)}\n"
        f"Decision: {decision.get('decision', 'PENDING')}\n"
        f"Composite risk grade: {summary.get('risk_grade', 'N/A')} ({risk.get('grade_label', 'N/A')})\n"
        f"Probability of default: {_fmt_pct(summary.get('pd_score', 0))}\n"
        f"Total lending rate: {_fmt_pct(premium.get('total_rate', 0))}\n\n"
        f"This memo summarizes the underwriting recommendation using the Five Cs of Credit for Indian corporate lending. "
        f"The recommendation reflects bureau conduct, operating cash generation, leverage, collateral support, market conditions, "
        f"and the documented stress tolerance of the borrower."
    )

    sections["character"] = (
        f"Bureau score: {features.get('bureau_score', 'N/A')}\n"
        f"Past defaults: {features.get('num_past_defaults', 0)}\n"
        f"Max DPD in last 12 months: {features.get('max_dpd_last_12_months', 0)} days\n"
        f"SMA buckets: SMA-0 {features.get('sma_0_accounts', 0)}, SMA-1 {features.get('sma_1_accounts', 0)}, "
        f"SMA-2 {features.get('sma_2_accounts', 0)}\n"
        f"RBI defaulter flag: {'Yes' if features.get('rbi_defaulter_flag') else 'No'}\n"
        f"Management quality: {web.get('management_quality', 'N/A')}\n"
        f"Litigation flag: {'Yes' if web.get('litigation_flag') else 'No'}\n"
        f"Primary insight sentiment: {web.get('primary_insights', {}).get('sentiment_category', 'neutral')} "
        f"({_fmt_num(web.get('primary_insights', {}).get('sentiment', 0), 2)})\n\n"
        f"Character assessment is anchored on bureau performance, promoter and management hygiene, litigation visibility from public registries, "
        f"and field diligence commentary. Adverse conduct indicators should override otherwise acceptable quantitative metrics."
    )

    sections["capacity"] = (
        f"Revenue: {_fmt_inr(features.get('revenue', 0))}\n"
        f"EBITDA: {_fmt_inr(features.get('ebitda', 0))}\n"
        f"Cash flow available for debt service: {_fmt_inr(features.get('cash_flow', 0))}\n"
        f"DSCR: {_fmt_num(features.get('dscr', 0), 2)}x\n"
        f"Cash flow stability: {_fmt_pct(features.get('cash_flow_stability', 0), 1)}\n"
        f"Average daily balance: {_fmt_inr(features.get('average_daily_balance', 0))}\n"
        f"EMI bounce count: {features.get('emi_bounce_count', 0)}\n"
        f"GST reported revenue: {_fmt_inr(features.get('gstr_3b_revenue', 0))}\n"
        f"Bank inflows considered: {_fmt_inr(features.get('bank_inflows_considered', features.get('total_inflows', 0)))}\n"
        f"GST-bank gap: {_fmt_inr(features.get('gst_bank_gap', 0))} ({_fmt_num(features.get('gst_bank_gap_pct', 0), 2)}%)\n"
        f"GST-bank correlation: {_fmt_num(features.get('gst_bank_correlation', 0), 2)}\n\n"
        f"Capacity assessment focuses on debt service resilience, stability of operating cash generation, and whether GST turnover is borne out by bank inflows. "
        f"Material GST-bank gaps indicate potential sales inflation, circular trading, or weak receivable realizations."
    )

    sections["capital"] = (
        f"Net worth: {_fmt_inr(features.get('net_worth', features.get('total_equity', 0)))}\n"
        f"Total debt: {_fmt_inr(features.get('total_debt', 0))}\n"
        f"Debt-to-equity: {_fmt_num(features.get('debt_equity_ratio', 0), 2)}x\n"
        f"Current ratio: {_fmt_num(features.get('current_ratio', 0), 2)}x\n"
        f"Expected loss: {_fmt_inr(capital_impact.get('expected_loss', 0))}\n"
        f"Capital required: {_fmt_inr(capital_impact.get('capital_required', 0))}\n"
        f"RAROC: {_fmt_num(capital_impact.get('raroc', 0), 2)}%\n\n"
        f"Capital reflects the sponsor buffer available to absorb volatility and the degree of leverage already embedded in the business. "
        f"Weak net worth or stretched leverage should reduce sanction quantum even where reported earnings remain positive."
    )

    sections["collateral"] = (
        f"Collateral value: {_fmt_inr(features.get('collateral_value', 0))}\n"
        f"Collateral coverage ratio: {_fmt_num(features.get('collateral_coverage', 0), 2)}x\n"
        f"Stressed collateral value: {_fmt_inr(stress.get('collateral_stress', {}).get('stressed_value', 0))}\n"
        f"Stressed collateral coverage: {_fmt_num(stress.get('collateral_stress', {}).get('stressed_coverage', 0), 2)}x\n\n"
        f"Collateral comfort is measured on both current and stressed values. Coverage below policy comfort should trigger structure enhancement, additional security, or tighter amortization."
    )

    sections["conditions"] = (
        f"Industry outlook: {web.get('industry_outlook', 'N/A')}\n"
        f"Sector growth rate: {_fmt_pct(web.get('industry_growth_rate', 0), 1)}\n"
        f"Sector default rate: {_fmt_pct(web.get('sector_default_rate', 0), 2)}\n"
        f"Combined stress DSCR: {_fmt_num(stress.get('combined_stress', {}).get('dscr', 0), 2)}x\n"
        f"Combined stress PD: {_fmt_pct(stress.get('combined_stress', {}).get('pd', 0))}\n"
        f"Survives combined stress: {'Yes' if stress.get('combined_stress', {}).get('survives_stress') else 'No'}\n"
        f"Regulatory risk: {web.get('regulatory_risk', 'N/A')}\n"
        f"Circular trading flag: {'Yes' if features.get('circular_trading_flag') else 'No'}\n\n"
        f"Proposed covenants:\n- " + "\n- ".join(covenants)
    )

    rationale = decision.get("reasoning", []) or ["No explicit rationale generated."]
    sections["final_recommendation"] = (
        f"Lending decision: {decision.get('decision', 'PENDING')}\n"
        f"Recommended limit: {_fmt_inr(recommended_limit)}\n"
        f"Pricing: base {_fmt_pct(premium.get('base_rate', 0))} + spread {_fmt_num(premium.get('spread', 0) * 10000, 0)} bps = {_fmt_pct(premium.get('total_rate', 0))}\n\n"
        f"Decision rationale:\n- " + "\n- ".join(rationale) + "\n\n"
        f"Report generated on {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}\n"
        f"Analysis ID: {analysis_data.get('analysis_id', 'N/A')}\n"
        f"Model version: GBClassifier v1.0 | GBRegressor v1.0"
    )

    return sections
