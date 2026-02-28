"""
PDF Builder
Generates professional PDF documents using ReportLab.
"""
import io
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from typing import Dict


def build_cam_pdf(sections: Dict[str, str], analysis_data: Dict) -> bytes:
    """Build a professional PDF from CAM sections."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=25*mm,
        leftMargin=25*mm,
        topMargin=30*mm,
        bottomMargin=25*mm,
    )

    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        "CoverTitle",
        parent=styles["Title"],
        fontSize=26,
        textColor=colors.HexColor("#0A1628"),
        spaceAfter=12,
        alignment=TA_CENTER,
        fontName="Helvetica-Bold",
    ))
    styles.add(ParagraphStyle(
        "CoverSubtitle",
        parent=styles["Normal"],
        fontSize=14,
        textColor=colors.HexColor("#4A5568"),
        alignment=TA_CENTER,
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        "SectionHeader",
        parent=styles["Heading1"],
        fontSize=16,
        textColor=colors.HexColor("#1A365D"),
        spaceBefore=20,
        spaceAfter=10,
        fontName="Helvetica-Bold",
        borderWidth=0,
        borderPadding=0,
    ))
    styles.add(ParagraphStyle(
        "BodyText2",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#2D3748"),
        alignment=TA_JUSTIFY,
        spaceAfter=8,
    ))
    styles.add(ParagraphStyle(
        "DecisionApprove",
        parent=styles["Normal"],
        fontSize=18,
        textColor=colors.HexColor("#22543D"),
        fontName="Helvetica-Bold",
        alignment=TA_CENTER,
        spaceBefore=10,
        spaceAfter=10,
    ))
    styles.add(ParagraphStyle(
        "DecisionReject",
        parent=styles["Normal"],
        fontSize=18,
        textColor=colors.HexColor("#742A2A"),
        fontName="Helvetica-Bold",
        alignment=TA_CENTER,
        spaceBefore=10,
        spaceAfter=10,
    ))
    styles.add(ParagraphStyle(
        "DecisionConditional",
        parent=styles["Normal"],
        fontSize=18,
        textColor=colors.HexColor("#744210"),
        fontName="Helvetica-Bold",
        alignment=TA_CENTER,
        spaceBefore=10,
        spaceAfter=10,
    ))
    styles.add(ParagraphStyle(
        "FooterStyle",
        parent=styles["Normal"],
        fontSize=8,
        textColor=colors.HexColor("#A0AEC0"),
        alignment=TA_CENTER,
    ))

    story = []

    # Cover page
    story.append(Spacer(1, 2*inch))
    story.append(Paragraph("CREDIT APPRAISAL MEMO", styles["CoverTitle"]))
    story.append(Spacer(1, 0.3*inch))
    story.append(HRFlowable(width="60%", thickness=2, color=colors.HexColor("#3182CE"), spaceAfter=20))

    company = analysis_data.get("company_name", "Borrower")
    story.append(Paragraph(company, styles["CoverSubtitle"]))
    story.append(Paragraph(f"Industry: {analysis_data.get('industry', 'N/A')}", styles["CoverSubtitle"]))
    story.append(Spacer(1, 0.5*inch))

    decision = analysis_data.get("decision", {}).get("decision", "N/A")
    decision_style = {
        "APPROVE": "DecisionApprove",
        "REJECT": "DecisionReject",
        "CONDITIONAL": "DecisionConditional",
    }.get(decision, "CoverSubtitle")
    story.append(Paragraph(f"Decision: {decision}", styles[decision_style]))

    story.append(Spacer(1, 0.3*inch))

    summary_data = analysis_data.get("decision", {}).get("summary", {})
    summary_table = Table([
        ["Risk Grade", str(summary_data.get("risk_grade", "N/A"))],
        ["Composite Score", f"{summary_data.get('composite_score', 0):.1f}/100"],
        ["PD", f"{summary_data.get('pd_score', 0):.2%}"],
        ["Recommended Limit", f"₹{summary_data.get('recommended_limit', 0):,.0f}"],
        ["Risk Premium", f"{summary_data.get('risk_premium_bps', 0)} bps"],
    ], colWidths=[2.5*inch, 2.5*inch])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#EBF4FF")),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#2D3748")),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E0")),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.HexColor("#F7FAFC"), colors.white]),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 0.5*inch))
    story.append(Paragraph("CONFIDENTIAL — FOR INTERNAL USE ONLY", styles["FooterStyle"]))
    story.append(Paragraph("Generated by AI Credit Officer", styles["FooterStyle"]))
    story.append(PageBreak())

    # Section mapping
    section_titles = {
        "executive_summary": "1. Executive Summary",
        "borrower_overview": "2. Borrower Overview",
        "industry_analysis": "3. Industry Analysis",
        "financial_analysis": "4. Financial Analysis",
        "risk_assessment": "5. Risk Assessment",
        "collateral_evaluation": "6. Collateral Evaluation",
        "stress_test_results": "7. Stress Test Results",
        "final_recommendation": "8. Final Recommendation",
    }

    for key, title in section_titles.items():
        content = sections.get(key, "")
        if not content:
            continue

        story.append(Paragraph(title, styles["SectionHeader"]))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E2E8F0"), spaceAfter=12))

        for line in content.split("\n"):
            line = line.strip()
            if not line:
                story.append(Spacer(1, 6))
            else:
                line = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                line = line.replace("✓", "PASS").replace("✗", "FAIL")
                story.append(Paragraph(line, styles["BodyText2"]))

        story.append(Spacer(1, 0.3*inch))

    # Disclaimer page
    story.append(PageBreak())
    story.append(Paragraph("Disclaimer", styles["SectionHeader"]))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E2E8F0"), spaceAfter=12))
    disclaimer = (
        "This Credit Appraisal Memo has been generated by an AI-powered credit decisioning system. "
        "While the analysis is based on rigorous quantitative methodologies including machine learning models, "
        "financial ratio analysis, and stress testing, it should be reviewed by qualified credit professionals "
        "before making final lending decisions. The AI Credit Officer provides recommendations based on "
        "available data and should be treated as a decision-support tool. All models are trained on synthetic "
        "datasets for demonstration purposes. Past performance metrics do not guarantee future predictive accuracy."
    )
    story.append(Paragraph(disclaimer, styles["BodyText2"]))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
