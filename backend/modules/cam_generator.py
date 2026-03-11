"""
CAM (Credit Appraisal Memo) Generator
Generates Five Cs-aligned CAM sections using Gemini API for natural,
executive-summary-style narratives that explicitly justify the final
Limit and Pricing based on SHAP values from the ML engine.

Falls back to structured formatted strings when the Gemini API is
unavailable, so the system never blocks on an LLM outage.
"""
import os
import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx

# ---------------------------------------------------------------------------
# Gemini configuration (shared with ingestion module)
# ---------------------------------------------------------------------------
GEMINI_API_KEY: Optional[str] = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL: str = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")
GEMINI_TIMEOUT_SEC: float = float(os.environ.get("GEMINI_TIMEOUT_SEC", "45"))


# ===================================================================
# Formatting helpers
# ===================================================================

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


# ===================================================================
# Covenant logic (structured — passed as data to LLM)
# ===================================================================

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
    # Deduplicate while preserving order
    unique: List[str] = []
    for covenant in covenants:
        if covenant not in unique:
            unique.append(covenant)
    return unique


# ===================================================================
# Gemini narrative generation
# ===================================================================

def _gemini_endpoint() -> str:
    return (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    )


async def _request_gemini_narrative(prompt: str) -> Optional[str]:
    """Call the Gemini API requesting fluent prose (plain text, not JSON).

    Returns the generated narrative string, or ``None`` if the API is
    unavailable or the call fails.
    """
    if not GEMINI_API_KEY:
        return None

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 1200},
    }
    try:
        async with httpx.AsyncClient(timeout=GEMINI_TIMEOUT_SEC) as client:
            response = await client.post(_gemini_endpoint(), json=payload)
            response.raise_for_status()
            body = response.json()
            text_parts = body.get("candidates", [{}])[0].get("content", {}).get("parts", [])
            combined = "\n".join(part.get("text", "") for part in text_parts).strip()
            return combined if combined else None
    except Exception as e:
        print(f"Gemini API Error: {e}")
        return None


def _build_cam_section_prompt(
    section_name: str,
    structured_data: Dict[str, Any],
    shap_factors: Optional[List[Dict[str, Any]]] = None,
) -> str:
    """Build a Gemini prompt for a single CAM section.

    The prompt instructs the LLM to produce a concise, executive-summary style
    narrative using the provided structured data points.  For the
    *final_recommendation* section, SHAP factors are included so the model
    can explicitly justify the limit and pricing recommendation.
    """
    data_block = "\n".join(f"  - {k}: {v}" for k, v in structured_data.items())

    shap_block = ""
    if shap_factors:
        shap_lines = [
            f"  - {f['factor']}: value={f.get('value')}, impact={f.get('impact')}, importance={f.get('importance', 0):.4f}"
            for f in shap_factors
        ]
        shap_block = (
            "\n\nSHAP-based risk drivers (from the ML model):\n"
            + "\n".join(shap_lines)
        )

    return (
        f"You are a senior credit officer at a Tier-1 Indian bank writing a "
        f"Credit Appraisal Memorandum (CAM).  Generate a flowing, executive-summary "
        f"style narrative for the **{section_name}** section.\n\n"
        f"Use the data points below as the factual foundation.  The narrative "
        f"must be concise (3-6 sentences), use professional banking language, "
        f"and explicitly reference the numbers.  Do NOT use bullet points or "
        f"markdown formatting – write in plain prose suitable for a PDF memo.\n\n"
        f"Data:\n{data_block}"
        f"{shap_block}\n\n"
        f"Write the narrative now:"
    )


# ===================================================================
# Fallback formatted-string builders (used when Gemini is unavailable)
# ===================================================================

def _fallback_executive_summary(
    company: str, industry: str, decision: Dict[str, Any],
    features: Dict[str, Any], summary: Dict[str, Any],
    risk: Dict[str, Any], premium: Dict[str, Any],
    loan_amount: float, recommended_limit: float,
) -> str:
    return (
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


def _fallback_character(features: Dict[str, Any], web: Dict[str, Any]) -> str:
    return (
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


def _fallback_capacity(features: Dict[str, Any]) -> str:
    return (
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


def _fallback_capital(features: Dict[str, Any], capital_impact: Dict[str, Any]) -> str:
    return (
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


def _fallback_collateral(features: Dict[str, Any], stress: Dict[str, Any]) -> str:
    return (
        f"Collateral value: {_fmt_inr(features.get('collateral_value', 0))}\n"
        f"Collateral coverage ratio: {_fmt_num(features.get('collateral_coverage', 0), 2)}x\n"
        f"Stressed collateral value: {_fmt_inr(stress.get('collateral_stress', {}).get('stressed_value', 0))}\n"
        f"Stressed collateral coverage: {_fmt_num(stress.get('collateral_stress', {}).get('stressed_coverage', 0), 2)}x\n\n"
        f"Collateral comfort is measured on both current and stressed values. Coverage below policy comfort should trigger structure enhancement, additional security, or tighter amortization."
    )


def _fallback_conditions(web: Dict[str, Any], stress: Dict[str, Any], features: Dict[str, Any], covenants: List[str]) -> str:
    return (
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


def _fallback_final_recommendation(
    decision: Dict[str, Any], recommended_limit: float,
    premium: Dict[str, Any], analysis_data: Dict[str, Any],
) -> str:
    rationale = decision.get("reasoning", []) or ["No explicit rationale generated."]
    return (
        f"Lending decision: {decision.get('decision', 'PENDING')}\n"
        f"Recommended limit: {_fmt_inr(recommended_limit)}\n"
        f"Pricing: base {_fmt_pct(premium.get('base_rate', 0))} + spread {_fmt_num(premium.get('spread', 0) * 10000, 0)} bps = {_fmt_pct(premium.get('total_rate', 0))}\n\n"
        f"Decision rationale:\n- " + "\n- ".join(rationale) + "\n\n"
        f"Report generated on {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}\n"
        f"Analysis ID: {analysis_data.get('analysis_id', 'N/A')}\n"
        f"Model version: GBClassifier v1.0 | GBRegressor v1.0"
    )


def _fallback_director_background(web: Dict[str, Any]) -> str:
    return (
        f"Management Quality: {web.get('management_quality', 'N/A')}\n"
        f"Litigation Visibility: {'Yes' if web.get('litigation_flag') else 'No'}\n\n"
        f"Director background is assessed based on public registry checks, eCourts litigation history, and general management track record."
    )


def _fallback_gst_variance(features: Dict[str, Any]) -> str:
    return (
        f"GSTR-3B Revenue: {_fmt_inr(features.get('gstr_3b_revenue', 0))}\n"
        f"Bank Inflows Considered: {_fmt_inr(features.get('bank_inflows_considered', features.get('total_inflows', 0)))}\n"
        f"GST-Bank Gap: {_fmt_inr(features.get('gst_bank_gap', 0))}\n"
        f"GST-Bank Gap (%): {_fmt_num(features.get('gst_bank_gap_pct', 0), 2)}%\n\n"
        f"This section triangulates reported operational revenue via GST against actual cash flows realized in the primary operating accounts."
    )


def _fallback_explainability(decision: Dict[str, Any], web: Dict[str, Any], factors: List[Dict[str, Any]]) -> str:
    status = decision.get("decision", "PENDING")
    rationale = decision.get("reasoning", ["No specific rationale provided."])
    litigation = "High litigation risk identified." if web.get("litigation_flag") else "No major litigation risk found."
    factor_str = ", ".join([f"{f['factor']} ({f['impact']})" for f in factors[:3]])
    return (
        f"The application was {status} explicitly due to the following rationale: {' '.join(rationale)}. "
        f"{litigation} Top machine learning drivers synthesizing this decision include: {factor_str}."
    )


# ===================================================================
# Main generator
# ===================================================================

async def generate_cam_content(analysis_data: Dict[str, Any]) -> Dict[str, str]:
    """Generate CAM sections structured around the Five Cs of Credit.

    Each section is generated by:
      1. Assembling structured data points into a dict.
      2. Building a Gemini prompt requesting executive prose.
      3. Calling the Gemini API for a fluent narrative concurrently.
      4. Falling back to the original formatted-string template if the API
         is unavailable.
    """
    company: str = analysis_data.get("company_name", "Borrower")
    industry: str = analysis_data.get("industry") or analysis_data.get("features", {}).get("industry", "N/A")
    decision: Dict[str, Any] = analysis_data.get("decision", {})
    features: Dict[str, Any] = analysis_data.get("features", {})
    web: Dict[str, Any] = analysis_data.get("web_research", {})
    stress: Dict[str, Any] = analysis_data.get("stress_test", {})
    risk: Dict[str, Any] = analysis_data.get("composite_risk", {})
    premium: Dict[str, Any] = analysis_data.get("risk_premium", {})
    capital_impact: Dict[str, Any] = analysis_data.get("capital_impact", {})
    shap_explanation: Dict[str, Any] = analysis_data.get("shap_explanation", {})
    summary: Dict[str, Any] = decision.get("summary", {})

    loan_amount: float = features.get("loan_amount_requested", 0)
    recommended_limit: float = summary.get("recommended_limit", 0)
    covenants: List[str] = _proposed_covenants(decision, features)
    risk_factors: List[Dict[str, Any]] = decision.get("risk_factors", []) or _top_shap_factors(shap_explanation)

    # Prepare datasets and prompts
    exec_data = {
        "Borrower": company,
        "Industry": industry,
        "Requested Facility": _fmt_inr(loan_amount),
        "Recommended Limit": _fmt_inr(recommended_limit),
        "Decision": decision.get("decision", "PENDING"),
        "Risk Grade": f"{summary.get('risk_grade', 'N/A')} ({risk.get('grade_label', 'N/A')})",
        "PD": _fmt_pct(summary.get("pd_score", 0)),
        "Total Lending Rate": _fmt_pct(premium.get("total_rate", 0)),
    }
    
    char_data = {
        "Bureau Score": features.get("bureau_score", "N/A"),
        "Past Defaults": features.get("num_past_defaults", 0),
        "Max DPD (12M)": f"{features.get('max_dpd_last_12_months', 0)} days",
        "SMA Buckets": f"SMA-0: {features.get('sma_0_accounts', 0)}, SMA-1: {features.get('sma_1_accounts', 0)}, SMA-2: {features.get('sma_2_accounts', 0)}",
        "RBI Defaulter": "Yes" if features.get("rbi_defaulter_flag") else "No",
        "Management Quality": web.get("management_quality", "N/A"),
        "Litigation Flag": "Yes" if web.get("litigation_flag") else "No",
        "Primary Insight Sentiment": f"{web.get('primary_insights', {}).get('sentiment_category', 'neutral')} ({_fmt_num(web.get('primary_insights', {}).get('sentiment', 0), 2)})",
    }
    
    cap_data = {
        "Revenue": _fmt_inr(features.get("revenue", 0)),
        "EBITDA": _fmt_inr(features.get("ebitda", 0)),
        "Cash Flow for Debt Service": _fmt_inr(features.get("cash_flow", 0)),
        "DSCR": f"{_fmt_num(features.get('dscr', 0), 2)}x",
        "DSCR Source": features.get("dscr_cmltd_source", "N/A"),
        "Cash Flow Stability": _fmt_pct(features.get("cash_flow_stability", 0), 1),
        "Average Daily Balance": _fmt_inr(features.get("average_daily_balance", 0)),
        "EMI Bounces": features.get("emi_bounce_count", 0),
        "GST-Bank Gap": f"{_fmt_num(features.get('gst_bank_gap_pct', 0), 2)}%",
    }
    
    capital_data = {
        "Net Worth": _fmt_inr(features.get("net_worth", features.get("total_equity", 0))),
        "Total Debt": _fmt_inr(features.get("total_debt", 0)),
        "Debt-to-Equity": f"{_fmt_num(features.get('debt_equity_ratio', 0), 2)}x",
        "Current Ratio": f"{_fmt_num(features.get('current_ratio', 0), 2)}x",
        "Expected Loss": _fmt_inr(capital_impact.get("expected_loss", 0)),
        "Capital Required": _fmt_inr(capital_impact.get("capital_required", 0)),
        "RAROC": f"{_fmt_num(capital_impact.get('raroc', 0), 2)}%",
    }

    coll_data = {
        "Collateral Value": _fmt_inr(features.get("collateral_value", 0)),
        "Coverage Ratio": f"{_fmt_num(features.get('collateral_coverage', 0), 2)}x",
        "Stressed Value": _fmt_inr(stress.get("collateral_stress", {}).get("stressed_value", 0)),
        "Stressed Coverage": f"{_fmt_num(stress.get('collateral_stress', {}).get('stressed_coverage', 0), 2)}x",
    }

    cond_data = {
        "Industry Outlook": web.get("industry_outlook", "N/A"),
        "Sector Growth Rate": _fmt_pct(web.get("industry_growth_rate", 0), 1),
        "Sector Default Rate": _fmt_pct(web.get("sector_default_rate", 0), 2),
        "Combined Stress DSCR": f"{_fmt_num(stress.get('combined_stress', {}).get('dscr', 0), 2)}x",
        "Survives Combined Stress": "Yes" if stress.get("combined_stress", {}).get("survives_stress") else "No",
        "Regulatory Risk": web.get("regulatory_risk", "N/A"),
        "Circular Trading Flag": "Yes" if features.get("circular_trading_flag") else "No",
        "Proposed Covenants": "; ".join(covenants),
    }

    rec_data = {
        "Decision": decision.get("decision", "PENDING"),
        "Recommended Limit": _fmt_inr(recommended_limit),
        "Base Rate": _fmt_pct(premium.get("base_rate", 0)),
        "Spread (bps)": _fmt_num(premium.get("spread", 0) * 10000, 0),
        "Total Rate": _fmt_pct(premium.get("total_rate", 0)),
        "Risk Grade": summary.get("risk_grade", "N/A"),
        "PD Score": _fmt_pct(summary.get("pd_score", 0)),
        "DSCR": f"{_fmt_num(summary.get('dscr', 0), 2)}x",
        "Collateral Coverage": f"{_fmt_num(summary.get('collateral_coverage', 0), 2)}x",
        "Decision Rationale": " | ".join(decision.get("reasoning", [])[:5]),
    }

    dir_data = {
        "Management Quality": web.get("management_quality", "N/A"),
        "Litigation Flag": "Yes" if web.get("litigation_flag") else "No"
    }

    gst_data = {
        "GSTR-3B Revenue": _fmt_inr(features.get("gstr_3b_revenue", 0)),
        "Bank Inflows Considered": _fmt_inr(features.get("bank_inflows_considered", features.get("total_inflows", 0))),
        "GST-Bank Gap": _fmt_inr(features.get("gst_bank_gap", 0)),
        "GST-Bank Gap (%)": f"{_fmt_num(features.get('gst_bank_gap_pct', 0), 2)}%",
    }

    expl_data = {
        "Decision Status": decision.get("decision", "PENDING"),
        "Primary Rationale": " | ".join(decision.get("reasoning", [])),
        "Litigation Risk Indicator": "High" if web.get("litigation_flag") else "Low",
        "GST Variance": f"{_fmt_num(features.get('gst_bank_gap_pct', 0), 2)}%",
    }

    # Gather promises for all requests concurrently
    prompts = [
        ("executive_summary", _build_cam_section_prompt("Executive Summary", exec_data)),
        ("character", _build_cam_section_prompt("Character", char_data)),
        ("capacity", _build_cam_section_prompt("Capacity", cap_data)),
        ("capital", _build_cam_section_prompt("Capital", capital_data)),
        ("collateral", _build_cam_section_prompt("Collateral", coll_data)),
        ("conditions", _build_cam_section_prompt("Conditions & Covenants", cond_data)),
        ("final_recommendation", _build_cam_section_prompt("Final Recommendation", rec_data, shap_factors=risk_factors)),
        ("director_background", _build_cam_section_prompt("Director Background Details", dir_data)),
        ("gst_variance", _build_cam_section_prompt("GST vs. Bank Statement Triangulation Variance", gst_data)),
        ("explainability", _build_cam_section_prompt("Decision Logic / Explainability", expl_data, shap_factors=risk_factors))
    ]

    responses = await asyncio.gather(
        *[_request_gemini_narrative(prompt) for _, prompt in prompts],
        return_exceptions=True
    )

    sections: Dict[str, str] = {}
    for i, (key, _) in enumerate(prompts):
        narrative = responses[i]
        if isinstance(narrative, Exception):
            print(f"Failed to generate {key}: {narrative}")
            narrative = None
        
        # Apply fallbacks
        if key == "executive_summary":
            sections[key] = narrative or _fallback_executive_summary(company, industry, decision, features, summary, risk, premium, loan_amount, recommended_limit)
        elif key == "character":
            sections[key] = narrative or _fallback_character(features, web)
        elif key == "capacity":
            sections[key] = narrative or _fallback_capacity(features)
        elif key == "capital":
            sections[key] = narrative or _fallback_capital(features, capital_impact)
        elif key == "collateral":
            sections[key] = narrative or _fallback_collateral(features, stress)
        elif key == "conditions":
            sections[key] = narrative or _fallback_conditions(web, stress, features, covenants)
        elif key == "final_recommendation":
            sections[key] = narrative or _fallback_final_recommendation(decision, recommended_limit, premium, analysis_data)
        elif key == "director_background":
            sections[key] = narrative or _fallback_director_background(web)
        elif key == "gst_variance":
            sections[key] = narrative or _fallback_gst_variance(features)
        elif key == "explainability":
            sections[key] = narrative or _fallback_explainability(decision, web, risk_factors)

    return sections


# Internal helper to extract SHAP factors from explanation dict
def _top_shap_factors(shap_explanation: Dict[str, Any]) -> List[Dict[str, Any]]:
    factors: List[Dict[str, Any]] = []
    for f in shap_explanation.get("top_5_factors", [])[:5]:
        shap_value = float(f.get("shap_value", 0) or 0)
        factors.append({
            "factor": f.get("feature", "unknown").replace("_", " ").title(),
            "value": f.get("feature_value", 0),
            "impact": "Increases Risk" if shap_value > 0 else "Decreases Risk",
            "importance": abs(shap_value),
        })
    return factors
