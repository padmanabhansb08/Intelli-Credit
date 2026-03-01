"""
CAM (Credit Appraisal Memo) Generator
Generates structured CAM text and exports to professional PDF.
"""
from typing import Dict, Any
from datetime import datetime


def generate_cam_content(analysis_data: Dict[str, Any]) -> Dict[str, str]:
    """Generate all 8 sections of the Credit Appraisal Memo."""
    company = analysis_data.get("company_name", "Borrower")
    industry = analysis_data.get("industry", "N/A")
    decision = analysis_data.get("decision", {})
    features = analysis_data.get("features", {})
    web = analysis_data.get("web_research", {})
    stress = analysis_data.get("stress_test", {})
    risk = analysis_data.get("composite_risk", {})
    premium = analysis_data.get("risk_premium", {})
    capital = analysis_data.get("capital_impact", {})
    shap = analysis_data.get("shap_explanation", {})
    summary = decision.get("summary", {})

    loan_amount = features.get("loan_amount_requested", 0)
    rec_limit = summary.get("recommended_limit", 0)
    pd_score = summary.get("pd_score", 0)
    grade = summary.get("risk_grade", "N/A")
    dscr = features.get("dscr", 0)

    sections = {}

    # 1. Executive Summary
    sections["executive_summary"] = (
        f"This Credit Appraisal Memo presents the comprehensive credit assessment of {company} "
        f"operating in the {industry} sector. The borrower has requested a credit facility of "
        f"₹{loan_amount:,.0f}.\n\n"
        f"Based on rigorous quantitative analysis including ML-based probability of default modeling, "
        f"financial ratio analysis, industry risk assessment, and stress testing, the AI Credit Officer "
        f"recommends: {decision.get('decision', 'N/A')}.\n\n"
        f"Key Highlights:\n"
        f"  • Risk Grade: {grade} ({risk.get('grade_label', 'N/A')})\n"
        f"  • Composite Risk Score: {risk.get('composite_score', 0):.1f}/100\n"
        f"  • Probability of Default: {pd_score:.2%}\n"
        f"  • Recommended Credit Limit: ₹{rec_limit:,.0f}\n"
        f"  • Risk Premium: {premium.get('spread', 0)*10000:.0f} bps over base rate\n"
        f"  • Total Lending Rate: {premium.get('total_rate', 0):.2%}\n"
        f"  • DSCR: {dscr:.2f}x\n\n"
        
        f"{decision.get('five_c_synthesis', 'Five C synthesis pending.')}\n"
    )

    # 2. Character & Capacity (Borrower Overview)
    years = analysis_data.get("years_in_business", "N/A")
    company_summary = decision.get("company_summary", {})
    
    sections["borrower_overview"] = (
        f"Company Name: {company}\n"
        f"Industry: {industry}\n"
        f"Years in Business: {years}\n"
        f"Bureau Score: {features.get('bureau_score', 'N/A')}\n"
        f"Past Defaults: {features.get('num_past_defaults', 0)}\n"
        f"Existing Exposure: ₹{features.get('existing_exposure', 0):,.0f}\n\n"
        
        f"--- AI Business Overview Synthesis ---\n"
        f"Business Model: {company_summary.get('business_model', 'N/A')}\n"
        f"Revenue Drivers: {company_summary.get('revenue_drivers', 'N/A')}\n"
        f"Key Dependencies: {company_summary.get('key_dependencies', 'N/A')}\n"
        f"Assessed Risk Level: {company_summary.get('risk_level', 'N/A')}\n"
        f"--------------------------------------\n\n"
        
        f"Management Quality Assessment: {web.get('management_quality', 'N/A')}\n"
        f"ESG Score: {web.get('esg_score', 'N/A')}/100\n\n"
        f"The borrower operates in the {company_summary.get('industry_sector', industry)} sector with {years} years of operational history. "
        f"The bureau score of {features.get('bureau_score', 'N/A')} indicates "
        f"{'strong' if features.get('bureau_score', 0) > 750 else 'adequate' if features.get('bureau_score', 0) > 650 else 'weak'} "
        f"credit history.\n\n"
        
        f"{features.get('qualitative_assessment', 'Qualitative Due-Diligence pending.')}\n"
    )

    # 3. Industry Analysis & External Intelligence
    macro = web.get("industry_macro", {})
    sections["industry_analysis"] = (
        f"Industry: {industry}\n"
        f"Sector Outlook: {web.get('industry_outlook', 'N/A')}\n"
        f"Sector Growth Rate: {macro.get('growth_rate', 0):.1%}\n"
        f"Sector Volatility: {macro.get('volatility', 0):.1%}\n"
        f"Sector Default Rate: {macro.get('default_rate_sector', 0):.2%}\n"
        f"Regulatory Risk: {web.get('regulatory_risk', 'N/A')}\n\n"
        
        f"{web.get('external_intelligence_summary', 'External web intelligence summary pending.')}\n"
    )

    # 4. Financial Analysis
    sections["financial_analysis"] = (
        f"Revenue: ₹{features.get('revenue', 0):,.0f}\n"
        f"Revenue Growth: {features.get('revenue_growth', 0):.1%}\n"
        f"EBITDA: ₹{features.get('ebitda', 0):,.0f}\n"
        f"EBITDA Margin: {features.get('ebitda_margin', 0):.1%}\n"
        f"Total Debt: ₹{features.get('total_debt', 0):,.0f}\n"
        f"Total Equity: ₹{features.get('total_equity', 0):,.0f}\n"
        f"Debt/Equity Ratio: {features.get('debt_equity_ratio', 0):.2f}x\n"
        f"Cash Flow: ₹{features.get('cash_flow', 0):,.0f}\n"
        f"DSCR: {dscr:.2f}x\n"
        f"Cash Flow Stability: {features.get('cash_flow_stability', 0):.1%}\n\n"
        
        f"{features.get('financial_llm_assessment', 'Standard financial assessment logic pending.')}\n"
    )

    # 5. Risk Assessment
    components = risk.get("components", {})
    sections["risk_assessment"] = (
        f"Composite Risk Score: {risk.get('composite_score', 0):.1f}/100\n"
        f"Risk Grade: {grade} - {risk.get('grade_label', 'N/A')}\n"
        f"Probability of Default: {pd_score:.2%}\n\n"
        f"Risk Component Breakdown:\n"
        f"  • PD Component: {components.get('pd_component', {}).get('score', 0):.1f} (weight: 30%)\n"
        f"  • Financial Health: {components.get('financial_health', {}).get('score', 0):.1f} (weight: 25%)\n"
        f"  • External/Web Risk: {components.get('web_risk', {}).get('score', 0):.1f} (weight: 20%)\n"
        f"  • Collateral Risk: {components.get('collateral_risk', {}).get('score', 0):.1f} (weight: 10%)\n"
        f"  • Stress Test Risk: {components.get('stress_risk', {}).get('score', 0):.1f} (weight: 15%)\n\n"
        f"Top Risk Factors (SHAP Analysis):\n"
    )
    for i, factor in enumerate(shap.get("top_5_factors", [])[:5], 1):
        feat_name = factor["feature"].replace("_", " ").title()
        sections["risk_assessment"] += (
            f"  {i}. {feat_name}: {factor.get('feature_value', 0):.4f} "
            f"({'Increases' if factor.get('shap_value', 0) > 0 else 'Decreases'} Risk)\n"
        )
        
    sections["risk_assessment"] += "\n" + features.get("unstructured_risk_assessment", "")

    # 6. Collateral Evaluation
    sections["collateral_evaluation"] = (
        f"Collateral Value: ₹{features.get('collateral_value', 0):,.0f}\n"
        f"Loan Amount Requested: ₹{loan_amount:,.0f}\n"
        f"Collateral Coverage Ratio: {features.get('collateral_coverage', 0):.2f}x\n\n"
        f"Assessment:\n"
        f"The collateral coverage ratio of {features.get('collateral_coverage', 0):.2f}x "
        f"{'exceeds the minimum 1.2x requirement, providing adequate security' if features.get('collateral_coverage', 0) >= 1.2 else 'is below the preferred 1.2x threshold, requiring additional security or guarantees'} "
        f"for the proposed facility.\n\n"
        f"Under stress conditions (collateral value decline of 15%), the coverage ratio would reduce to "
        f"{stress.get('collateral_stress', {}).get('stressed_coverage', 0):.2f}x."
    )

    # 7. Stress Test Results
    base = stress.get("base_case", {})
    rev_stress = stress.get("revenue_stress", {})
    rate_stress = stress.get("rate_stress", {})
    combined = stress.get("combined_stress", {})

    sections["stress_test_results"] = (
        f"Scenario Analysis:\n\n"
        f"Base Case:\n"
        f"  DSCR: {base.get('dscr', 0):.2f}x | PD: {base.get('pd', 0):.2%}\n\n"
        f"Scenario 1 - Revenue Decline (-20%):\n"
        f"  DSCR: {rev_stress.get('dscr', 0):.2f}x (Δ {rev_stress.get('dscr_change', 0):+.2f})\n"
        f"  PD: {rev_stress.get('pd', 0):.2%} (Δ {rev_stress.get('pd_change', 0):+.2%})\n\n"
        f"Scenario 2 - Interest Rate Increase (+200bps):\n"
        f"  DSCR: {rate_stress.get('dscr', 0):.2f}x (Δ {rate_stress.get('dscr_change', 0):+.2f})\n"
        f"  PD: {rate_stress.get('pd', 0):.2%} (Δ {rate_stress.get('pd_change', 0):+.2%})\n\n"
        f"Combined Stress:\n"
        f"  DSCR: {combined.get('dscr', 0):.2f}x (Δ {combined.get('dscr_change', 0):+.2f})\n"
        f"  PD: {combined.get('pd', 0):.2%}\n"
        f"  Survives Combined Stress: {'Yes ✓' if combined.get('survives_stress') else 'No ✗'}\n"
    )

    # 8. Final Recommendation
    decision_text = decision.get("decision", "N/A")
    sections["final_recommendation"] = (
        f"LENDING DECISION: {decision_text}\n\n"
        f"Recommended Credit Limit: ₹{rec_limit:,.0f}\n"
        f"Pricing: Base Rate ({premium.get('base_rate', 0):.2%}) + Spread ({premium.get('spread', 0)*10000:.0f} bps) = {premium.get('total_rate', 0):.2%}\n\n"
    )

    if decision_text == "APPROVE":
        sections["final_recommendation"] += (
            f"Rationale:\n"
            + "\n".join(f"  • {r}" for r in decision.get("reasoning", []))
            + "\n\nStandard Conditions:\n"
            + "  • Annual review of credit facility\n"
            + "  • Quarterly financial statement submission\n"
            + "  • Maintenance of minimum DSCR of 1.2x\n"
        )
    elif decision_text == "CONDITIONAL":
        sections["final_recommendation"] += (
            f"Rationale:\n"
            + "\n".join(f"  • {r}" for r in decision.get("reasoning", []))
            + "\n\nConditions for Approval:\n"
            + "\n".join(f"  • {c}" for c in decision.get("conditions", []))
        )
    else:
        sections["final_recommendation"] += (
            f"Rationale for Rejection:\n"
            + "\n".join(f"  • {r}" for r in decision.get("reasoning", []))
            + "\n\nRecommendation:\n"
            + "  • Re-apply after addressing identified risk factors\n"
            + "  • Improve financial ratios and/or provide additional collateral\n"
        )

    if capital:
        sections["final_recommendation"] += (
            f"\n\nCapital Impact Assessment:\n"
            f"  • Expected Loss: ₹{capital.get('expected_loss', 0):,.0f}\n"
            f"  • Risk-Weighted Assets: ₹{capital.get('risk_weighted_assets', 0):,.0f}\n"
            f"  • Capital Required: ₹{capital.get('capital_required', 0):,.0f}\n"
            f"  • RAROC: {capital.get('raroc', 0):.1f}%\n"
            f"  • Capital Ratio Impact: {capital.get('bank_impact', {}).get('ratio_impact_bps', 0):.2f} bps\n"
        )

    sections["final_recommendation"] += (
        f"\n\nReport generated by AI Credit Officer on {datetime.utcnow().strftime('%B %d, %Y at %H:%M UTC')}\n"
        f"Analysis ID: {analysis_data.get('analysis_id', 'N/A')}\n"
        f"Model Version: GBClassifier v1.0 | GBRegressor v1.0"
    )

    return sections
