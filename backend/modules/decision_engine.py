"""
Decision Engine
Applies lending decision rules via a configurable rules engine with
hard knock-out conditions and SHAP-based explainability.

Risk appetite parameters (PD thresholds, DSCR limits, collateral
minimums, approved grades, etc.) are injection-ready via the
``risk_appetite`` argument to :func:`make_decision`.
"""
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Sequence

# ===================================================================
# Default Risk Appetite Configuration
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
    # DPD
    "max_dpd_knockout": 90,
    # Sales inflation
    "sales_inflation_knockout_pct": 30,
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
# Rule Definitions
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


# Approval-gate evaluators return (reasoning_line, condition_line | None)
# If the gate *fails* they return None (no contribution).

def _eval_approve_grade(
    grade: str, appetite: Dict[str, Any], composite_risk: Dict[str, Any],
) -> Optional[str]:
    if grade in appetite.get("approved_grades", ("A", "B")):
        return f"Risk grade {grade} ({composite_risk.get('grade_label')}) is within approved risk appetite."
    return None


def _eval_approve_pd(pd_score: float, appetite: Dict[str, Any]) -> Optional[str]:
    if pd_score < appetite.get("pd_threshold_approve", 0.30):
        return f"Probability of default at {pd_score:.1%} is below the {appetite['pd_threshold_approve']:.0%} threshold."
    return None


def _eval_approve_dscr(dscr: float, appetite: Dict[str, Any]) -> Optional[str]:
    if dscr >= appetite.get("dscr_min_approve", 1.5):
        return f"DSCR of {dscr:.2f}x supports debt servicing under base case assumptions."
    return None


def _eval_approve_collateral(coverage: float, appetite: Dict[str, Any]) -> Optional[str]:
    if coverage >= appetite.get("collateral_coverage_min", 1.0):
        return None  # Passes silently; narratives are added where noteworthy
    return None


def _eval_approve_bureau(bureau_score: int, appetite: Dict[str, Any]) -> Optional[str]:
    if bureau_score >= appetite.get("bureau_score_strong", 750):
        return f"Bureau score of {bureau_score} indicates strong repayment conduct."
    return None


def _eval_approve_gst(features: Dict[str, Any], appetite: Dict[str, Any]) -> Optional[str]:
    gap_pct = float(features.get("gst_bank_gap_pct", 0) or 0)
    if gap_pct <= appetite.get("gst_bank_gap_max_approve", 10):
        return "GST turnover and bank inflows are broadly aligned."
    return None


# ===================================================================
# Conditional-decision evaluators: return (reasoning, condition) tuples
# ===================================================================

def _cond_litigation(
    web_research: Dict[str, Any],
) -> Optional[tuple]:
    if web_research.get("litigation_flag"):
        return (
            "Active litigation or court references require legal review before disbursement.",
            "Complete legal clearance on all identified court matters.",
        )
    return None


def _cond_pd(pd_score: float, appetite: Dict[str, Any]) -> Optional[tuple]:
    threshold = appetite.get("pd_threshold_approve", 0.30)
    if pd_score >= threshold:
        return (
            f"Probability of default at {pd_score:.1%} is elevated for an unconditional approval.",
            "Sanction with tighter monitoring and enhanced pricing approval.",
        )
    return None


def _cond_dscr(dscr: float, appetite: Dict[str, Any]) -> Optional[tuple]:
    if dscr < appetite.get("dscr_min_approve", 1.5):
        return (
            f"DSCR of {dscr:.2f}x is below policy comfort.",
            "Obtain monthly cash flow statements and monitor DSCR quarterly.",
        )
    return None


def _cond_collateral(coverage: float, appetite: Dict[str, Any]) -> Optional[tuple]:
    preferred = appetite.get("collateral_coverage_preferred", 1.20)
    if coverage < preferred:
        return (
            f"Collateral coverage of {coverage:.2f}x is below the preferred {preferred:.2f}x level.",
            f"Enhance collateral or obtain promoter support to reach {preferred:.2f}x coverage.",
        )
    return None


def _cond_gst_gap(features: Dict[str, Any], appetite: Dict[str, Any]) -> Optional[tuple]:
    gap_pct = float(features.get("gst_bank_gap_pct", 0) or 0)
    if gap_pct > appetite.get("gst_bank_gap_conditional", 15):
        return (
            "GST revenue does not sufficiently map to bank inflows.",
            "Provide monthly GST-bank reconciliation and debtor ageing certification.",
        )
    return None


def _cond_emi_bounces(features: Dict[str, Any]) -> Optional[tuple]:
    bounces = features.get("emi_bounce_count", 0)
    if bounces:
        return (
            f"Observed {bounces} EMI-related bounces in bank statement analysis.",
            "No EMI bounce permitted during the initial monitoring period.",
        )
    return None


# ===================================================================
# Core Decision Function (Rules Engine)
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
    """Make lending decision: APPROVE, CONDITIONAL, or REJECT.

    Instead of deeply nested ``if/elif`` blocks, the function iterates
    through three ordered rule phases:

    1. **Knock-out rules** – any match triggers an immediate REJECT.
    2. **Approval gates** – *all* must pass for an unconditional APPROVE.
    3. **Conditional evaluators** – each matching rule appends reasoning
       and conditions for a CONDITIONAL decision.

    Risk appetite parameters are dynamically injectable via the
    ``risk_appetite`` keyword argument; when ``None`` the module-level
    ``DEFAULT_RISK_APPETITE`` is used.
    """
    appetite = {**DEFAULT_RISK_APPETITE, **(risk_appetite or {})}

    grade: str = composite_risk.get("grade", "C")
    composite_score: float = composite_risk.get("composite_score", 50)
    litigation: bool = web_research.get("litigation_flag", False)
    dscr: float = float(features.get("dscr", 1) or 0)
    collateral_coverage: float = float(features.get("collateral_coverage", 1) or 0)
    bureau_score: int = int(features.get("bureau_score", 700) or 700)

    reasoning: List[str] = []
    conditions: List[str] = []
    decision = "REJECT"

    # ── Phase 1: Knock-out rules ──────────────────────────────────────
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
    else:
        # ── Phase 2: Approval gates ───────────────────────────────────
        approve_checks = [
            _eval_approve_grade(grade, appetite, composite_risk),
            _eval_approve_pd(pd_score, appetite),
            _eval_approve_dscr(dscr, appetite),
            _eval_approve_collateral(collateral_coverage, appetite),
        ]
        all_gates_pass = (
            grade in appetite.get("approved_grades", ("A", "B"))
            and pd_score < appetite.get("pd_threshold_approve", 0.30)
            and not litigation
            and dscr >= appetite.get("dscr_min_approve", 1.5)
            and collateral_coverage >= appetite.get("collateral_coverage_min", 1.0)
        )

        if all_gates_pass:
            decision = "APPROVE"
            for line in approve_checks:
                if line:
                    reasoning.append(line)
            extra = _eval_approve_bureau(bureau_score, appetite)
            if extra:
                reasoning.append(extra)
            extra = _eval_approve_gst(features, appetite)
            if extra:
                reasoning.append(extra)

        elif grade in appetite.get("conditional_grades", ("A", "B", "C")) and pd_score < appetite.get("pd_threshold_max", 0.50):
            # ── Phase 3: Conditional evaluators ───────────────────────
            decision = "CONDITIONAL"
            reasoning.append(f"Risk grade {grade} requires structure enhancement and tighter monitoring.")

            cond_evaluators = [
                lambda: _cond_litigation(web_research),
                lambda: _cond_pd(pd_score, appetite),
                lambda: _cond_dscr(dscr, appetite),
                lambda: _cond_collateral(collateral_coverage, appetite),
                lambda: _cond_gst_gap(features, appetite),
                lambda: _cond_emi_bounces(features),
            ]
            for evaluator in cond_evaluators:
                result = evaluator()
                if result:
                    reasoning.append(result[0])
                    conditions.append(result[1])

            if not conditions:
                conditions.append("Enhanced quarterly monitoring by relationship and risk teams.")

        else:
            # ── Phase 4: Hard reject ─────────────────────────────────
            reasoning.append(f"Risk grade {grade} ({composite_risk.get('grade_label')}) exceeds credit appetite.")
            if pd_score >= appetite.get("pd_threshold_max", 0.50):
                reasoning.append(f"Probability of default at {pd_score:.1%} is unacceptably high.")
            if dscr < appetite.get("dscr_min_conditional", 1.0):
                reasoning.append(f"DSCR of {dscr:.2f}x indicates inadequate debt servicing capacity.")
            if litigation:
                reasoning.append("External litigation exposure remains unresolved.")
            if collateral_coverage < appetite.get("collateral_coverage_min", 1.0):
                reasoning.append(
                    f"Collateral coverage of {collateral_coverage:.2f}x is below minimum support expectations."
                )

    # Append primary-insight flags that decision rules haven't already covered
    for flag in web_research.get("primary_insights", {}).get("flags", []):
        if flag not in reasoning:
            reasoning.append(flag)

    return {
        "decision": decision,
        "reasoning": reasoning,
        "conditions": conditions,
        "risk_factors": _top_risk_factors(shap_explanation),
        "risk_appetite_used": appetite,
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
