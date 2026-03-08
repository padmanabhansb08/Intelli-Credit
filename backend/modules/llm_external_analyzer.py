from typing import Dict, Any

def analyze_external_intelligence(web_data: Dict[str, Any]) -> str:
    """
    LLM Simulator (Phase 4): Analyzes external web intelligence 
    (News, MCA filings, e-Courts litigation, Regulatory updates) for credit appraisal.
    
    Tasks:
    - Identify promoter-related risks
    - Identify sector or regulatory headwinds
    - Flag any reputational or governance concerns
    - Summarize how external factors affect credit risk
    """
    
    # Extract Base Data
    sentiment_score = web_data.get("sentiment_score", 0.0)
    sentiment_cat = web_data.get("sentiment_category", "neutral")
    litigation = web_data.get("litigation_flag", False)
    mgt_quality = web_data.get("management_quality", "Average")
    reg_risk = web_data.get("regulatory_risk", "Low")
    headlines = web_data.get("news_headlines", [])
    macro = web_data.get("industry_macro", {})
    
    # 1. Promoter & Governance Concerns
    gov_issues = []
    if mgt_quality == "Poor":
        gov_issues.append("MCA filings indicate frequent changes in key managerial personnel (KMP) or poor board composition.")
    if litigation:
        gov_issues.append("Active litigation flag identified on e-Courts portal against the corporate entity or its promoters.")
    
    # Scan headlines for promoter/governance keywords
    for h in [item.get("headline", "").lower() for item in headlines]:
        if any(w in h for w in ["fraud", "investigation", "sebi", "cbi", "ed", "raid", "siphoning"]):
            gov_issues.append("CRITICAL: Severe promoter integrity flags flagged in recent news cycles (regulatory investigations/raids).")
            break
            
    gov_comment = ""
    if gov_issues:
        gov_comment = "Reputational & Governance Concerns Identified:\n- " + "\n- ".join(gov_issues)
    else:
        gov_comment = "No major promoter integrity issues, adverse regulatory actions, or corporate governance red flags detected in MCA/e-Court proxy scans."

    # 2. Sector & Regulatory Headwinds
    sector_outlook = macro.get("outlook", "Stable")
    
    sector_comment = f"The industry is currently facing a '{sector_outlook}' macroeconomic environment. "
    if reg_risk == "High":
         sector_comment += "WARNING: Severe regulatory headwinds face this sector, with potential changes in government policy (e.g., environmental norms, import limits, or price caps) threatening margin stability."
    elif reg_risk == "Medium":
         sector_comment += "Moderate regulatory scrutiny applies to this operating segment. Maintain standard compliance monitoring."
    else:
         sector_comment += "Regulatory and compliance burden is standard for the operating sector, with no immediate adverse policy shifts anticipated."

    # 3. Overall News Sentiment Impact
    news_comment = ""
    if sentiment_cat == "negative":
        news_comment = f"Recent media coverage is overwhelmingly negative (Score: {sentiment_score:.2f}), indicating potential reputational damage or widespread market pessimism regarding the business operations."
    elif sentiment_cat == "positive":
        news_comment = f"Media sentiment is positive (Score: {sentiment_score:.2f}), bolstering market confidence and suggesting strong ecosystem relationships."
    else:
        news_comment = "Current media coverage is neutral or absent, exerting no significant directional pressure on the credit profile."

    # 4. Final Credit Risk Summary
    impact_summary = ""
    if gov_issues or reg_risk == "High" or sentiment_cat == "negative":
        impact_summary = "Adverse external factors significantly elevate the overall credit risk profile. Stringent mitigants and enhanced post-disbursement monitoring are mandatory before proceeding with any exposure."
    else:
        impact_summary = "External intelligence scans yield a benign risk environment. Exogenous market and governance factors do not pose a material threat to the proposed credit facility."

    # Format Output
    output = (
        f"--- AI EXTERNAL INTELLIGENCE SUMMARY ---\n\n"
        f"1. Promoter & Governance Review:\n{gov_comment}\n\n"
        f"2. Sector & Regulatory Headwinds:\n{sector_comment}\n\n"
        f"3. Reputational & Media Analysis:\n{news_comment}\n\n"
        f"4. Credit Impact Synthesis:\n{impact_summary}\n"
        f"----------------------------------------"
    )
    
    return output
