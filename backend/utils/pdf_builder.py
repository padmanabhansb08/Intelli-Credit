"""
PDF Builder
Generates professional PDF documents using ReportLab.
"""
import io
from typing import Dict

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch, mm
from reportlab.platypus import HRFlowable, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def build_cam_pdf(sections: Dict[str, str], analysis_data: Dict) -> bytes:
    """Build a professional PDF from CAM sections."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=25 * mm,
        leftMargin=25 * mm,
        topMargin=30 * mm,
        bottomMargin=25 * mm,
    )

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            "CoverTitle",
            parent=styles["Title"],
            fontSize=26,
            textColor=colors.HexColor("#0A1628"),
            spaceAfter=12,
            alignment=TA_CENTER,
            fontName="Helvetica-Bold",
        )
    )
    styles.add(
        ParagraphStyle(
            "CoverSubtitle",
            parent=styles["Normal"],
            fontSize=14,
            textColor=colors.HexColor("#4A5568"),
            alignment=TA_CENTER,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            "SectionHeader",
            parent=styles["Heading1"],
            fontSize=16,
            textColor=colors.HexColor("#1A365D"),
            spaceBefore=20,
            spaceAfter=10,
            fontName="Helvetica-Bold",
        )
    )
    styles.add(
        ParagraphStyle(
            "BodyText2",
            parent=styles["Normal"],
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#2D3748"),
            alignment=TA_JUSTIFY,
            spaceAfter=8,
        )
    )
    for name, color in {
        "DecisionApprove": "#22543D",
        "DecisionReject": "#742A2A",
        "DecisionConditional": "#744210",
    }.items():
        styles.add(
            ParagraphStyle(
                name,
                parent=styles["Normal"],
                fontSize=18,
                textColor=colors.HexColor(color),
                fontName="Helvetica-Bold",
                alignment=TA_CENTER,
                spaceBefore=10,
                spaceAfter=10,
            )
        )
    styles.add(
        ParagraphStyle(
            "FooterStyle",
            parent=styles["Normal"],
            fontSize=8,
            textColor=colors.HexColor("#A0AEC0"),
            alignment=TA_CENTER,
        )
    )

    story = []
    story.append(Spacer(1, 2 * inch))
    story.append(Paragraph("CREDIT APPRAISAL MEMO", styles["CoverTitle"]))
    story.append(Spacer(1, 0.3 * inch))
    story.append(HRFlowable(width="60%", thickness=2, color=colors.HexColor("#3182CE"), spaceAfter=20))

    company = analysis_data.get("company_name", "Borrower")
    story.append(Paragraph(company, styles["CoverSubtitle"]))
    story.append(Paragraph(f"Industry: {analysis_data.get('industry', 'N/A')}", styles["CoverSubtitle"]))
    story.append(Spacer(1, 0.5 * inch))

    decision = analysis_data.get("decision", {}).get("decision", "N/A")
    decision_style = {
        "APPROVE": "DecisionApprove",
        "REJECT": "DecisionReject",
        "CONDITIONAL": "DecisionConditional",
    }.get(decision, "CoverSubtitle")
    story.append(Paragraph(f"Decision: {decision}", styles[decision_style]))

    summary_data = analysis_data.get("decision", {}).get("summary", {})
    summary_table = Table(
        [
            ["Risk Grade", str(summary_data.get("risk_grade", "N/A"))],
            ["Composite Score", f"{summary_data.get('composite_score', 0):.1f}/100"],
            ["PD", f"{summary_data.get('pd_score', 0):.2%}"],
            ["Recommended Limit", f"INR {summary_data.get('recommended_limit', 0):,.0f}"],
            ["Risk Premium", f"{summary_data.get('risk_premium_bps', 0)} bps"],
        ],
        colWidths=[2.5 * inch, 2.5 * inch],
    )
    summary_table.setStyle(
        TableStyle(
            [
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
            ]
        )
    )
    story.append(summary_table)
    story.append(Spacer(1, 0.5 * inch))
    story.append(Paragraph("CONFIDENTIAL - FOR INTERNAL USE ONLY", styles["FooterStyle"]))
    story.append(Paragraph("Generated by AI Credit Officer", styles["FooterStyle"]))
    story.append(PageBreak())

    section_titles = {
        "executive_summary": "1. Executive Summary",
        "character": "2. Character",
        "capacity": "3. Capacity",
        "capital": "4. Capital",
        "collateral": "5. Collateral",
        "conditions": "6. Conditions",
        "final_recommendation": "7. Final Recommendation",
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
                continue
            escaped = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            escaped = escaped.replace("PASS", "PASS").replace("FAIL", "FAIL")
            story.append(Paragraph(escaped, styles["BodyText2"]))
        story.append(Spacer(1, 0.3 * inch))

    story.append(PageBreak())
    story.append(Paragraph("Disclaimer", styles["SectionHeader"]))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E2E8F0"), spaceAfter=12))
    disclaimer = (
        "This Credit Appraisal Memo has been generated by an AI-powered credit decisioning system. "
        "While the analysis uses machine learning models, financial ratio analysis, document extraction, and stress testing, "
        "it should be reviewed by qualified credit professionals before final sanction. The system is a decision-support layer, "
        "not an autonomous sanction authority."
    )
    story.append(Paragraph(disclaimer, styles["BodyText2"]))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
