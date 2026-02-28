"""
Stress Test Module
Simulates revenue shocks and interest rate increases, recomputes key metrics.
"""
from typing import Dict, Any


def run_stress_test(features: Dict[str, Any], pd_score: float) -> Dict[str, Any]:
    """
    Run stress test scenarios:
    - Revenue decline of 20%
    - Interest rate increase of 200bps
    """
    revenue = features.get("revenue", 0)
    ebitda_margin = features.get("ebitda_margin", 0.15)
    cash_flow = features.get("cash_flow", 0)
    annual_debt_service = features.get("annual_debt_service", 1)
    total_debt = features.get("total_debt", 0)
    interest_expense = features.get("interest_expense", 0)
    dscr = features.get("dscr", 1)
    collateral_value = features.get("collateral_value", 0)
    loan_amount = features.get("loan_amount_requested", 1)

    # Scenario 1: Revenue decline -20%
    stressed_revenue = revenue * 0.80
    stressed_ebitda = stressed_revenue * ebitda_margin
    stressed_cash_flow_rev = cash_flow * 0.75  # Cash flow drops more than revenue
    stressed_dscr_rev = stressed_cash_flow_rev / max(annual_debt_service, 1)
    stressed_pd_rev = min(pd_score * 1.4, 0.99)

    # Scenario 2: Interest rate +200bps
    rate_increase = 0.02
    additional_interest = total_debt * rate_increase
    stressed_debt_service_rate = annual_debt_service + additional_interest
    stressed_cash_flow_rate = cash_flow - additional_interest * 0.3
    stressed_dscr_rate = stressed_cash_flow_rate / max(stressed_debt_service_rate, 1)
    stressed_pd_rate = min(pd_score * 1.25, 0.99)

    # Combined scenario
    combined_cash_flow = cash_flow * 0.75 - additional_interest * 0.3
    combined_dscr = combined_cash_flow / max(stressed_debt_service_rate, 1)
    combined_pd = min(pd_score * 1.6, 0.99)

    # Collateral stress: -15% value decline
    stressed_collateral = collateral_value * 0.85
    stressed_collateral_coverage = stressed_collateral / max(loan_amount, 1)

    return {
        "base_case": {
            "revenue": round(revenue, 0),
            "ebitda": round(revenue * ebitda_margin, 0),
            "cash_flow": round(cash_flow, 0),
            "dscr": round(dscr, 2),
            "pd": round(pd_score, 4),
            "collateral_coverage": round(collateral_value / max(loan_amount, 1), 2),
        },
        "revenue_stress": {
            "scenario": "Revenue decline -20%",
            "revenue": round(stressed_revenue, 0),
            "ebitda": round(stressed_ebitda, 0),
            "cash_flow": round(stressed_cash_flow_rev, 0),
            "dscr": round(stressed_dscr_rev, 2),
            "pd": round(stressed_pd_rev, 4),
            "dscr_change": round(stressed_dscr_rev - dscr, 2),
            "pd_change": round(stressed_pd_rev - pd_score, 4),
        },
        "rate_stress": {
            "scenario": "Interest rate +200bps",
            "additional_interest": round(additional_interest, 0),
            "cash_flow": round(stressed_cash_flow_rate, 0),
            "dscr": round(stressed_dscr_rate, 2),
            "pd": round(stressed_pd_rate, 4),
            "dscr_change": round(stressed_dscr_rate - dscr, 2),
            "pd_change": round(stressed_pd_rate - pd_score, 4),
        },
        "combined_stress": {
            "scenario": "Revenue -20% + Rate +200bps",
            "cash_flow": round(combined_cash_flow, 0),
            "dscr": round(combined_dscr, 2),
            "pd": round(combined_pd, 4),
            "dscr_change": round(combined_dscr - dscr, 2),
            "pd_change": round(combined_pd - pd_score, 4),
            "survives_stress": combined_dscr > 1.0,
        },
        "collateral_stress": {
            "scenario": "Collateral value -15%",
            "original_value": round(collateral_value, 0),
            "stressed_value": round(stressed_collateral, 0),
            "stressed_coverage": round(stressed_collateral_coverage, 2),
        },
    }
