"""
Risk Synthesis Engine
Combines all risk signals into a unified composite risk score and grade.
"""
import numpy as np
from typing import Dict, Any


GRADE_MAP = [
    (0, 20, "A", "Excellent"),
    (20, 35, "B", "Good"),
    (35, 55, "C", "Moderate"),
    (55, 75, "D", "High Risk"),
    (75, 100, "E", "Very High Risk"),
]


def compute_composite_risk(pd_score: float, features: Dict[str, Any],
                            web_research: Dict[str, Any],
                            stress_test: Dict[str, Any]) -> Dict[str, Any]:
    """
    Synthesize all risk signals into a composite risk score (0-100).
    Lower score = better credit quality.
    """

    # 1. PD Component (weight: 30%)
    pd_component = pd_score * 100

    # 2. Financial Health Score (weight: 25%)
    dscr = features.get("dscr", 1)
    debt_equity = features.get("debt_equity_ratio", 1)
    ebitda_margin = features.get("ebitda_margin", 0.15)
    revenue_growth = features.get("revenue_growth", 0)
    cash_flow_stability = features.get("cash_flow_stability", 0.7)
    bureau_score = features.get("bureau_score", 700)

    financial_health = (
        max(0, min(100, 100 - (dscr - 0.5) * 30)) * 0.20 +
        max(0, min(100, debt_equity * 15)) * 0.20 +
        max(0, min(100, (0.3 - ebitda_margin) * 200)) * 0.15 +
        max(0, min(100, (0.1 - revenue_growth) * 200)) * 0.15 +
        max(0, min(100, (1 - cash_flow_stability) * 100)) * 0.15 +
        max(0, min(100, (900 - bureau_score) / 6)) * 0.15
    )

    # 3. Web/External Risk Score (weight: 20%)
    web_risk = web_research.get("web_risk_score", 40)

    # 4. Collateral Coverage (weight: 10%)
    collateral_coverage = features.get("collateral_coverage", 1)
    collateral_risk = max(0, min(100, (2 - collateral_coverage) * 50))

    # 5. Stress Test Impact (weight: 15%)
    combined_stress = stress_test.get("combined_stress", {})
    stress_dscr = combined_stress.get("dscr", 1)
    survives = combined_stress.get("survives_stress", True)
    stress_risk = max(0, min(100, (1.5 - stress_dscr) * 50))
    if not survives:
        stress_risk = min(100, stress_risk + 20)

    # Weighted composite
    composite = (
        pd_component * 0.30 +
        financial_health * 0.25 +
        web_risk * 0.20 +
        collateral_risk * 0.10 +
        stress_risk * 0.15
    )
    composite = round(max(0, min(100, composite)), 2)

    # Map to grade
    grade = "C"
    grade_label = "Moderate"
    for low, high, g, label in GRADE_MAP:
        if low <= composite < high:
            grade = g
            grade_label = label
            break
    if composite >= 75:
        grade = "E"
        grade_label = "Very High Risk"

    return {
        "composite_score": composite,
        "grade": grade,
        "grade_label": grade_label,
        "components": {
            "pd_component": {"score": round(pd_component, 2), "weight": 0.30, "weighted": round(pd_component * 0.30, 2)},
            "financial_health": {"score": round(financial_health, 2), "weight": 0.25, "weighted": round(financial_health * 0.25, 2)},
            "web_risk": {"score": round(web_risk, 2), "weight": 0.20, "weighted": round(web_risk * 0.20, 2)},
            "collateral_risk": {"score": round(collateral_risk, 2), "weight": 0.10, "weighted": round(collateral_risk * 0.10, 2)},
            "stress_risk": {"score": round(stress_risk, 2), "weight": 0.15, "weighted": round(stress_risk * 0.15, 2)},
        },
        "thresholds": {
            "A": "0-20 (Excellent)",
            "B": "20-35 (Good)",
            "C": "35-55 (Moderate)",
            "D": "55-75 (High Risk)",
            "E": "75-100 (Very High Risk)",
        },
    }


def compute_capital_impact(loan_amount: float, pd_score: float, lgd: float = 0.45,
                            composite_score: float = 50, bank_capital: float = 1e10,
                            bank_rwa: float = 6e10) -> Dict[str, Any]:
    """
    Compute portfolio capital impact of approving this loan.
    Simulates impact on bank's capital ratios, expected loss, and RAROC.
    """
    # Expected Loss
    expected_loss = loan_amount * pd_score * lgd

    # Risk-Weighted Assets (Basel II simplified approach)
    risk_weight = min(2.5, 0.5 + pd_score * 3)
    rwa = loan_amount * risk_weight

    # Capital requirement (8% of RWA per Basel)
    capital_required = rwa * 0.08

    # RAROC calculation
    net_income_on_loan = loan_amount * 0.03  # Assume 3% net margin
    raroc = (net_income_on_loan - expected_loss) / max(capital_required, 1)

    # Impact on bank ratios
    new_rwa = bank_rwa + rwa
    new_capital_ratio = bank_capital / new_rwa
    current_capital_ratio = bank_capital / bank_rwa
    ratio_impact = new_capital_ratio - current_capital_ratio

    return {
        "expected_loss": round(expected_loss, 0),
        "expected_loss_rate": round(pd_score * lgd * 100, 2),
        "risk_weighted_assets": round(rwa, 0),
        "risk_weight": round(risk_weight, 2),
        "capital_required": round(capital_required, 0),
        "raroc": round(raroc * 100, 2),
        "raroc_acceptable": raroc > 0.15,
        "bank_impact": {
            "current_capital_ratio": round(current_capital_ratio * 100, 2),
            "new_capital_ratio": round(new_capital_ratio * 100, 2),
            "ratio_impact_bps": round(ratio_impact * 10000, 2),
            "capital_consumed_pct": round(capital_required / bank_capital * 100, 4),
        },
        "lgd_assumption": lgd,
    }
