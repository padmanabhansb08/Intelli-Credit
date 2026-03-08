from typing import Dict, Any

def analyze_structured_financials(features: Dict[str, Any]) -> str:
    """
    LLM Simulator: Analyzes structured financial data (GST, Bank, ITR) and outputs
    a clear financial risk assessment in plain business language.
    
    Tasks handled:
    - Identify revenue trends
    - Comment on cash flow stability
    - Highlight any inconsistencies or red flags
    - Assess repayment capacity
    """
    
    # 1. Identify Revenue Trends (GST vs ITR vs Current)
    revenue = features.get("revenue", 0)
    rev_growth = features.get("revenue_growth", 0)
    gst_turnover = features.get("annual_gst_turnover", revenue)
    
    revenue_trend = ""
    if rev_growth > 0.15:
        revenue_trend = f"The borrower demonstrates strong revenue momentum, growing at {rev_growth:.1%} year-over-year."
    elif rev_growth > 0:
        revenue_trend = f"The borrower is maintaining stable, positive revenue growth ({rev_growth:.1%} YoY)."
    else:
        revenue_trend = f"The borrower is experiencing revenue contraction, declining by {abs(rev_growth):.1%} YoY."
        
    if abs(revenue - gst_turnover) / max(revenue, 1) > 0.2:
        revenue_trend += f" Note: There is a notable variance between ITR declared revenue (₹{revenue:,.0f}) and annualized GST turnover (₹{gst_turnover:,.0f})."
    else:
        revenue_trend += " Sales reported in ITR reconcile closely with GST return filings, indicating strong reporting hygiene."

    # 2. Comment on Cash Flow Stability (Bank Statements)
    cf_stability = features.get("cash_flow_stability", 0)
    bounces = features.get("bounce_count_6m", 0)
    avg_balance = features.get("average_monthly_balance", 0)
    
    cash_flow_comment = ""
    if cf_stability > 0.8:
        cash_flow_comment = f"Cash flow remains highly resilient with a stability index of {cf_stability:.1%}. Average monthly balances are maintained at comfortable levels (₹{avg_balance:,.0f})."
    elif cf_stability > 0.5:
        cash_flow_comment = f"Operating cash flows exhibit moderate variance (stability index: {cf_stability:.1%}). Account balances fluctuate consistently with working capital cycles."
    else:
        cash_flow_comment = f"Cash flows are highly volatile (stability index: {cf_stability:.1%}), suggesting irregular collection periods or lumpy order execution."
        
    business_credits = features.get("monthly_business_credits", 0)
    if business_credits > 0:
         cash_flow_comment += f" Typical monthly inflows average around ₹{business_credits:,.0f}."

    # 3. Highlight Inconsistencies or Red Flags
    red_flags = []
    if bounces > 0:
        red_flags.append(f"High-risk indicator: {bounces} cheque/mandate bounces recorded in the last 6 months.")
    
    if features.get("total_debt", 0) > features.get("total_equity", 1) * 3:
        red_flags.append(f"Aggressive leverage structure (D/E ratio exceeds 3.0x).")
        
    it_ebitda = features.get("ebitda_margin", 0)
    if it_ebitda < 0.05:
        red_flags.append(f"Razor-thin operating margins ({it_ebitda:.1%}) leave negligible room to absorb macroeconomic shocks.")
        
    red_flag_comment = ""
    if red_flags:
        red_flag_comment = "Key Red Flags:\n- " + "\n- ".join(red_flags)
    else:
        red_flag_comment = "No major inconsistencies or red flags were observed in the financial data triad (GST, Bank, ITR)."

    # 4. Assess Repayment Capacity
    dscr = features.get("dscr", 1.0) # Ensure DSCR is piped or estimate it
    ebitda = features.get("ebitda", 0)
    debt = features.get("total_debt", 0)
    
    capacity_comment = ""
    if dscr >= 1.5:
        capacity_comment = f"Repayment footprint is robust. With a DSCR of {dscr:.2f}x, operating cash streams comfortably cover existing and proposed debt obligations."
    elif dscr >= 1.0:
        capacity_comment = f"Repayment capacity is adequate but tight. A DSCR of {dscr:.2f}x meets minimum servicing requirements but warns of vulnerability to revenue shocks."
    else:
        capacity_comment = f"WARNING: Repayment capability is deeply strained. The current DSCR of {dscr:.2f}x indicates core operations generate insufficient surplus to service peak debt levels."

    # Final Synthesis
    assessment = (
        f"--- AI FINANCIAL RISK ASSESSMENT ---\n\n"
        f"1. Revenue Trends:\n{revenue_trend}\n\n"
        f"2. Cash Flow Stability:\n{cash_flow_comment}\n\n"
        f"3. Discrepancies & Red Flags:\n{red_flag_comment}\n\n"
        f"4. Repayment Capacity:\n{capacity_comment}\n"
    )
    
    return assessment
