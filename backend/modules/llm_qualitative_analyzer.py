from typing import Dict, Any
from textblob import TextBlob

def analyze_qualitative_inputs(site_visit_notes: str, management_notes: str) -> str:
    """
    LLM Simulator (Phase 5): Integrates qualitative due-diligence inputs into credit risk assessment.
    
    Tasks:
    - Interpret how inputs affect business stability and repayment capacity.
    - Adjust risk perception accordingly.
    - Clearly explain the impact of human observations on credit risk.
    - Respond as a senior credit manager.
    """
    combined_notes = f"{site_visit_notes or ''} {management_notes or ''}".strip()
    
    if not combined_notes or len(combined_notes) < 10:
        return (
            "--- QUALITATIVE DUE-DILIGENCE ASSESSMENT (SENIOR CREDIT MANAGER) ---\n"
            "Observation: Minimal qualitative inputs provided.\n"
            "Impact on Repayment: Cannot ascertain management depth or operational reality.\n"
            "Risk Adjustment: Standard risk limits maintained. Proceed with caution.\n"
            "--------------------------------------------------------------------\n"
        )
        
    lower_notes = combined_notes.lower()
    
    # NLP Sentiment to gauge management and operational tone
    try:
        sentiment = TextBlob(combined_notes).sentiment.polarity
    except Exception:
        sentiment = 0.0

    # 1. Business Stability
    stability_comment = ""
    if any(w in lower_notes for w in ["strike", "idle", "obsolete", "attrition", "disruption", "poor"]):
        stability_comment = "Site visit observations reveal operational inefficiencies or potential labor/machinery challenges. This threatens top-line stability and increases vulnerability to macroeconomic shocks."
    elif any(w in lower_notes for w in ["efficient", "modern", "capacity utilization", "strong", "skilled"]):
        stability_comment = "Physical plant observations confirm a well-maintained operational infrastructure with healthy capacity utilization, reinforcing long-term business stability."
    else:
        stability_comment = "Operational footprint appears standard for the designated scale, posing no immediate threat to recurring business stability."

    # 2. Management & Repayment Capacity
    repayment_comment = ""
    if any(w in lower_notes for w in ["evasive", "unclear", "succession", "key-man risk", "inconsistent"]):
        repayment_comment = "Management interviews exposed strategic ambiguity or evasive responses regarding forward-looking cash flows. This deeply undermines confidence in their repayment capacity during stress cycles."
    elif any(w in lower_notes for w in ["vision", "conservative", "clear strategy", "experienced", "professional"]):
        repayment_comment = "Promoter interactions demonstrate robust financial conservatism and a clear strategic roadmap. This highly professional governance structure directly supports long-term repayment capacity."
    else:
        repayment_comment = "Management displays adequate competence to execute the core business model and maintain sufficient surplus for standard debt servicing."

    # 3. Risk Perception Adjustment
    risk_adjustment = ""
    if sentiment > 0.2:
        risk_adjustment = "DOWNWARD RISK ADJUSTMENT: The strong qualitative indicators from on-ground due diligence mitigate perceived statistical risks. I recommend a favorable risk premium adjustment."
    elif sentiment < -0.1 or "evasive" in lower_notes or "idle" in lower_notes:
        risk_adjustment = "UPWARD RISK ADJUSTMENT: Human observations actively override baseline financial hygiene. The operational or managerial red flags noted demand cautious underwriting and tightened covenant structuring."
    else:
        risk_adjustment = "NEUTRAL RISK ADJUSTMENT: Qualitative findings align with systemic financial inputs. No manual override to the calculated Probability of Default (PD) is warranted at this time."

    # Final Output formatting as Senior Credit Manager
    output = (
        f"--- QUALITATIVE DUE-DILIGENCE ASSESSMENT (SENIOR CREDIT MANAGER) ---\n\n"
        f"1. Operational Consistency & Stability:\n{stability_comment}\n\n"
        f"2. Promoter Quality & Repayment Conviction:\n{repayment_comment}\n\n"
        f"3. Senior Credit Override:\n{risk_adjustment}\n"
        f"--------------------------------------------------------------------"
    )
    
    return output
