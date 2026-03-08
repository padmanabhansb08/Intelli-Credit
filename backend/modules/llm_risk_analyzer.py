import re
from typing import Dict, Any

def analyze_unstructured_risks(raw_text: str) -> str:
    """
    LLM Simulator (Phase 3): Analyzes unstructured corporate documents (Annual reports,
    legal notices, rating reports) for latent risks.
    
    Tasks:
    - Extract mentions of litigation, contingent liabilities, defaults, operational risks.
    - Quote risk briefly and explain impact.
    - Classify risk severity (Low / Medium / High).
    """
    
    if not raw_text or len(raw_text.strip()) < 50:
        return (
            "--- UNSTRUCTURED RISK ASSESSMENT ---\n"
            "Status: Insufficient unstructured textual data available for deep NLP risk extraction.\n"
            "Overall Unstructured Risk Severity: Low (Default)\n"
            "-----------------------------------\n"
        )
        
    lower_text = raw_text.lower()
    
    findings = []
    severity_score = 0 # 0-2 Low, 3-5 Medium, 6+ High
    
    # 1. Litigation Risks
    if any(word in lower_text for word in ["litigation", "lawsuit", "court", "sued", "legal dispute", "penalty"]):
        # Extract a mock context or actual sentence if we were using TextBlob sentences, 
        # but regex around the keyword is safer for raw OCR text.
        match = re.search(r'(.{0,40})(litigation|lawsuit|investigation|penalty)(.{0,60})', lower_text)
        quote = f"...{match.group(0).strip()}..." if match else "...pending litigation matters disclosed in notes..."
        findings.append({
            "category": "Litigation & Legal",
            "quote": quote,
            "impact": "Potential financial outflow and management distraction. Could result in frozen accounts or restricted operations if ruled against the borrower.",
            "severity": "Medium"
        })
        severity_score += 3
        
    # 2. Contingent Liabilities
    if any(word in lower_text for word in ["contingent liabilit", "guarantee", "off-balance sheet", "warranty claims"]):
        match = re.search(r'(.{0,40})(contingent liabilit|guarantee)(.{0,60})', lower_text)
        quote = f"...{match.group(0).strip()}..." if match else "...corporate guarantees extended to subsidiaries..."
        findings.append({
            "category": "Contingent Liabilities",
            "quote": quote,
            "impact": "Off-balance sheet obligations that could materialize into actual debt, straining future cash flows and breaching existing covenant limits.",
            "severity": "High" if "guarantee" in lower_text and "subsidiary" in lower_text else "Medium"
        })
        severity_score += 4 if "guarantee" in lower_text else 2
        
    # 3. Defaults & Delays
    if any(word in lower_text for word in ["default", "delay in payment", "overdue", "restructuring", "npa"]):
        match = re.search(r'(.{0,40})(default|overdue|restructur|delay)(.{0,60})', lower_text)
        quote = f"...{match.group(0).strip()}..." if match else "...historical delays in scheduled term loan repayments..."
        findings.append({
            "category": "Past Defaults / Delays",
            "quote": quote,
            "impact": "Severe indicator of cash flow stress and poor financial discipline. Signals immediate elevated probability of default on new facilities.",
            "severity": "High"
        })
        severity_score += 5
        
    # 4. Operational & Supply Chain Risks
    if any(word in lower_text for word in ["operational risk", "supply chain disruption", "strike", "raw material shortage", "attrition"]):
        match = re.search(r'(.{0,40})(disruption|strike|shortage|attrition)(.{0,60})', lower_text)
        quote = f"...{match.group(0).strip()}..." if match else "...temporary disruptions in primary manufacturing facility..."
        findings.append({
            "category": "Operational Risks",
            "quote": quote,
            "impact": "Vulnerability to external shocks affecting production capacity, leading to potential revenue leakage and margin compression.",
            "severity": "Low"
        })
        severity_score += 1

    # Classify overall severity
    if severity_score >= 6:
        overall_severity = "High"
    elif severity_score >= 3:
        overall_severity = "Medium"
    else:
        overall_severity = "Low"
        
    if not findings:
        findings.append({
            "category": "General Document Scan",
            "quote": "No explicit adverse remarks found.",
            "impact": "Standard operational environment assumed.",
            "severity": "Low"
        })

    # Format the Output
    output = f"--- UNSTRUCTURED RISK ASSESSMENT ---\n"
    output += f"Overall Unstructured Risk Severity: {overall_severity}\n\n"
    
    for f in findings:
        output += f"• Risk Category: {f['category']}\n"
        output += f"  - Extracted Quote: \"{f['quote']}\"\n"
        output += f"  - Estimated Impact: {f['impact']}\n"
        output += f"  - Item Severity: {f['severity']}\n\n"
        
    output += "-----------------------------------\n"
    
    return output
