"""
Risk Synthesis Engine
Combines all risk signals into a unified composite risk score and grade.
"""
try:
    import numpy as np
except ImportError:
    np = None
from typing import Dict, Any


GRADE_MAP = [
    (0, 20, "A", "Excellent"),
    (20, 35, "B", "Good"),
    (35, 55, "C", "Moderate"),
    (55, 75, "D", "High Risk"),
    (75, 100, "E", "Very High Risk"),
]


def compute_composite_risk(pd_score: float, features: Dict[str, Any], web_research: Dict[str, Any], stress_test: Dict[str, Any]) -> Dict[str, Any]:
    """
    Synthesize risk into a deterministic "5 Cs of Credit" composite score (0-100).
    Lower score = better credit quality.
    Weights: Capacity (25%), Capital (20%), Character (20%), Collateral (20%), Conditions (15%).
    Applies hard penalties for severe OSINT/GST flags and generates a reasoning matrix.
    """
    reasoning_matrix = []
    
    # 1. Capacity (25%) - Ability to repay (DSCR & Cash Flow)
    dscr = features.get("dscr", 1.0)
    cash_flow_stability = features.get("cash_flow_stability", 0.7)
    capacity_score = max(0, min(100, 100 - (dscr - 0.5) * 40)) * 0.5 + max(0, min(100, (1 - cash_flow_stability) * 100)) * 0.5
    capacity_weight = 0.25
    reasoning_matrix.append(f"Capacity [{capacity_weight*100}%]: Scored {capacity_score:.1f} based on DSCR ({dscr:.2f}) and CF stability.")

    # 2. Capital (20%) - Skin in the game (Leverage & Net Worth)
    debt_equity = features.get("debt_equity_ratio", 1.0)
    capital_score = max(0, min(100, debt_equity * 25))
    capital_weight = 0.20
    
    gstr_mismatch = features.get("gstr_mismatch_flag", False)
    if gstr_mismatch:
        capital_score = min(100, capital_score + 25)  # Penalty increases risk score
        reasoning_matrix.append("Capital Penalty: Added 25 risk points due to detected GSTR-3B vs 2A tax variance > 5%.")
    reasoning_matrix.append(f"Capital [{capital_weight*100}%]: Scored {capital_score:.1f} based on Leverage (D/E: {debt_equity:.2f}).")

    # 3. Character (20%) - Willingness to repay (Bureau, OSINT, Management)
    bureau_score = features.get("bureau_score", 700)
    base_character = max(0, min(100, (900 - bureau_score) / 6))
    character_weight = 0.20
    
    nclt_flag = features.get("nclt_flag", False)
    if nclt_flag:
        base_character = 100  # Max risk
        reasoning_matrix.append("Character Penalty: Applied MAXIMUM risk score (100) due to active NCLT/IBC insolvency proceedings detected.")
    else:
        reasoning_matrix.append(f"Character [{character_weight*100}%]: Scored {base_character:.1f} based on Bureau ({bureau_score}). No NCLT flags.")
        
    character_score = base_character

    # 4. Collateral (20%) - Security
    collateral_coverage = features.get("collateral_coverage", 1.0)
    collateral_score = max(0, min(100, (2 - collateral_coverage) * 50))
    collateral_weight = 0.20
    reasoning_matrix.append(f"Collateral [{collateral_weight*100}%]: Scored {collateral_score:.1f} based on Coverage Ratio ({collateral_coverage:.2f}x).")

    # 5. Conditions (15%) - Macro & Stress Test
    web_risk = web_research.get("web_risk_score", 40)
    survives_stress = stress_test.get("survives_stress", True)
    conditions_score = web_risk * 0.6 + (0 if survives_stress else 40)
    conditions_weight = 0.15
    reasoning_matrix.append(f"Conditions [{conditions_weight*100}%]: Scored {conditions_score:.1f} based on Industry Macro and Stress Test Resilience.")

    # Weighted composite
    composite = (
        capacity_score * capacity_weight +
        capital_score * capital_weight +
        character_score * character_weight +
        collateral_score * collateral_weight +
        conditions_score * conditions_weight
    )
    
    # Add PD baseline impact implicitly (this replaces the old 30% PD weight to make it a pure 5C model)
    composite = round(max(0, min(100, composite)), 2)
    reasoning_matrix.append(f"Final Composite Risk Score calculated at {composite}/100.")

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
        "reasoning_matrix": reasoning_matrix,
        "components": {
            "capacity": {"score": round(capacity_score, 2), "weight": capacity_weight},
            "capital": {"score": round(capital_score, 2), "weight": capital_weight},
            "character": {"score": round(character_score, 2), "weight": character_weight},
            "collateral": {"score": round(collateral_score, 2), "weight": collateral_weight},
            "conditions": {"score": round(conditions_score, 2), "weight": conditions_weight},
        }
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
