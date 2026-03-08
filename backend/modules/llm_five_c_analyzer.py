from typing import Dict, Any

def synthesize_five_cs(features: Dict[str, Any], web_data: Dict[str, Any]) -> str:
    """
    LLM Simulator (Phase 6): Generates the structured Five Cs of Credit evaluation.
    
    Tasks:
    - Evaluate borrower on Character, Capacity, Capital, Collateral, Conditions
    - Provide brief assessment, key supporting points, and Risk Level per C.
    """
    
    # Extract prerequisite analysis chunks
    qualitative = features.get("qualitative_assessment", "")
    unstructured_risk = features.get("unstructured_risk_assessment", "")
    financial_llm = features.get("financial_llm_assessment", "")
    external_intel = web_data.get("external_intelligence_summary", "")
    
    bureau_score = features.get("bureau_score", 0)
    dscr = features.get("dscr", 0.0)
    col_coverage = features.get("collateral_coverage", 0.0)
    debt_equity = features.get("debt_equity_ratio", 0.0)
    
    # 1. CHARACTER
    char_level = "Low"
    char_points = [f"Bureau score of {bureau_score}."]
    if "evasive" in qualitative.lower() or "integrity" in external_intel.lower() or "fraud" in external_intel.lower():
        char_level = "High"
        char_points.append("Significant governance or promoter integrity red flags noted in web/qualitative checks.")
    elif bureau_score < 650:
        char_level = "Medium"
        char_points.append("Sub-prime bureau history indicates past repayment friction.")
    else:
        char_points.append("Clean historic track record and benign management interview feedback.")
        
    char_assessment = (
        f"CHARACTER - Risk Level: {char_level}\n"
        f"Assessment: Management intent and historical credit behavior.\n"
        f"Key Points: " + " | ".join(char_points)
    )

    # 2. CAPACITY
    cap_level = "Low"
    cap_points = [f"DSCR stands at {dscr:.2f}x."]
    if dscr < 1.0 or "insufficient" in financial_llm.lower():
        cap_level = "High"
        cap_points.append("Severe cash flow deficit rendering current debt service unsustainable.")
    elif dscr < 1.3 or "tight" in financial_llm.lower():
        cap_level = "Medium"
        cap_points.append("Strained cash flows leave limited margin for operational shocks.")
    else:
        cap_points.append("Robust operational cash surplus comfortably covers debt obligations.")
        
    cap_assessment = (
        f"CAPACITY - Risk Level: {cap_level}\n"
        f"Assessment: Ability to service debt through core operating cash flows.\n"
        f"Key Points: " + " | ".join(cap_points)
    )

    # 3. CAPITAL
    capital_level = "Low"
    capital_points = [f"Debt/Equity Ratio is {debt_equity:.2f}x."]
    if debt_equity > 3.0:
        capital_level = "High"
        capital_points.append("Aggressive leverage structure implies insufficient promoter skin-in-the-game.")
    elif debt_equity > 1.5:
        capital_level = "Medium"
        capital_points.append("Moderate leverage requiring ongoing monitoring of retained earnings.")
    else:
        capital_points.append("Conservative capital structure providing strong equity buffering.")
        
    capital_assessment = (
        f"CAPITAL - Risk Level: {capital_level}\n"
        f"Assessment: Financial leverage and promoter equity commitment.\n"
        f"Key Points: " + " | ".join(capital_points)
    )

    # 4. COLLATERAL
    col_level = "Low"
    col_points = [f"Collateral coverage ratio at {col_coverage:.2f}x."]
    if col_coverage < 1.0:
        col_level = "High"
        col_points.append("Under-collateralized facility posing severe loss-given-default (LGD) risk.")
    elif col_coverage < 1.25:
        col_level = "Medium"
        col_points.append("Marginal security cover susceptible to asset depreciation.")
    else:
        col_points.append("Strong tangible security cover exceeding baseline thresholds.")
        
    col_assessment = (
        f"COLLATERAL - Risk Level: {col_level}\n"
        f"Assessment: Quality and adequacy of backup security.\n"
        f"Key Points: " + " | ".join(col_points)
    )

    # 5. CONDITIONS
    cond_level = "Low"
    cond_points = [f"Sector Outlook: {web_data.get('industry_macro', {}).get('outlook', 'Stable')}."]
    if "severe regulatory headwinds" in external_intel.lower() or "disruption" in unstructured_risk.lower():
        cond_level = "High"
        cond_points.append("Macroeconomic, regulatory, or operational disruption severely threatens business continuity.")
    elif "moderate" in external_intel.lower() or web_data.get("sentiment_category") == "negative":
        cond_level = "Medium"
        cond_points.append("Challenging industry headwinds or negative market sentiment prevailing.")
    else:
        cond_points.append("Benign macroeconomic environment and stable operating conditions.")
        
    cond_assessment = (
        f"CONDITIONS - Risk Level: {cond_level}\n"
        f"Assessment: Exogenous macroeconomic, sector, and regulatory environment.\n"
        f"Key Points: " + " | ".join(cond_points)
    )

    output = (
        f"--- FIVE Cs OF CREDIT SYNTHESIS ---\n\n"
        f"{char_assessment}\n\n"
        f"{cap_assessment}\n\n"
        f"{capital_assessment}\n\n"
        f"{col_assessment}\n\n"
        f"{cond_assessment}\n"
        f"-----------------------------------\n"
    )
    
    return output
