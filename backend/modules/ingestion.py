"""
Data Ingestion Module
Handles PDF parsing, bank statement analysis, bureau parsing, and financial ratio extraction.
"""
import base64
import io
import json
import os
import re
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

import httpx
import numpy as np
import pandas as pd
import pdfplumber

try:
    from databricks import sql
except ImportError:
    sql = None

DATABRICKS_SERVER_HOSTNAME = os.environ.get("DATABRICKS_SERVER_HOSTNAME", "mock.cloud.databricks.com")
DATABRICKS_HTTP_PATH = os.environ.get("DATABRICKS_HTTP_PATH", "sql/1.0/endpoints/mock")
DATABRICKS_ACCESS_TOKEN = os.environ.get("DATABRICKS_ACCESS_TOKEN", "mock-token")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")
GEMINI_TIMEOUT_SEC = float(os.environ.get("GEMINI_TIMEOUT_SEC", "45"))
BANK_CATEGORY_BATCH_SIZE = int(os.environ.get("BANK_CATEGORY_BATCH_SIZE", "40"))

FINANCIAL_FIELDS = [
    "revenue",
    "net_income",
    "total_assets",
    "total_liabilities",
    "total_equity",
    "ebitda",
    "total_debt",
    "cash_and_equivalents",
    "operating_cash_flow",
    "depreciation",
    "interest_expense",
    "tax_expense",
    "current_assets",
    "current_liabilities",
    "accounts_receivable",
    "inventory",
]

UNSTRUCTURED_DOCUMENT_TYPES = {
    "board_minutes",
    "rating_report",
    "sanction_letter",
    "credit_note",
    "unstructured_document",
}

# Document types that require specialised Gemini extraction prompts
SPECIALISED_DOCUMENT_TYPES = {
    "itr",
    "shareholding_pattern",
    "gst_return",
}

ALLOWED_TRANSACTION_CATEGORIES = {
    "customer_receipt",
    "gateway_settlement",
    "vendor_payment",
    "tax_payment",
    "salary_credit",
    "cash_deposit",
    "cash_withdrawal",
    "internal_transfer",
    "loan_repayment",
    "emi_bounce",
    "chargeback",
    "bank_charge",
    "other",
    "uncategorized",
}

ALLOWED_PAYMENT_GATEWAYS = {
    "razorpay",
    "billdesk",
    "payu",
    "cashfree",
    "phonepe",
    "paytm",
    "bharatpe",
    "bank_transfer",
    "none",
    "unknown",
}

FIELD_PATTERNS = {
    "revenue": [
        r"(?:total\s+)?revenue[:\s]+(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)",
        r"(?:net\s+)?sales[:\s]+(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)",
        r"turnover[:\s]+(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)",
        r"income\s+from\s+operations[:\s]+(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)",
    ],
    "net_income": [
        r"net\s+(?:income|profit)[:\s]+(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)",
        r"profit\s+after\s+tax[:\s]+(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)",
        r"\bpat[:\s]+(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)",
    ],
    "total_assets": [r"total\s+assets[:\s]+(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)"],
    "total_liabilities": [r"total\s+liabilities[:\s]+(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)"],
    "total_equity": [
        r"(?:total\s+)?(?:shareholders?\s+)?equity[:\s]+(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)",
        r"net\s+worth[:\s]+(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)",
    ],
    "ebitda": [
        r"\bebitda[:\s]+(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)",
        r"earnings\s+before\s+interest[^:]*[:\s]+(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)",
    ],
    "total_debt": [
        r"total\s+(?:borrowings?|debt)[:\s]+(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)",
        r"long[\s-]term\s+(?:debt|borrowings?)[:\s]+(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)",
    ],
    "cash_and_equivalents": [
        r"cash\s+(?:and\s+)?(?:cash\s+)?equivalents?[:\s]+(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)",
        r"cash\s+(?:and|&)\s+bank[:\s]+(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)",
    ],
    "operating_cash_flow": [
        r"(?:operating|operational)\s+cash\s+flow[:\s]+(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)",
        r"cash\s+from\s+operations[:\s]+(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)",
    ],
    "depreciation": [r"depreciation[:\s]+(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)"],
    "interest_expense": [
        r"interest\s+(?:expense|cost)[:\s]+(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)",
        r"finance\s+cost[:\s]+(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)",
    ],
    "tax_expense": [r"tax\s+expense[:\s]+(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)"],
    "current_assets": [r"(?:total\s+)?current\s+assets[:\s]+(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)"],
    "current_liabilities": [r"(?:total\s+)?current\s+liabilities[:\s]+(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)"],
    "accounts_receivable": [r"accounts\s+receivable[:\s]+(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)"],
    "inventory": [r"inventory[:\s]+(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)"],
}



def _safe_float(value: Any, default: float = 0.0) -> float:
    if value is None or value == "":
        return default
    if isinstance(value, (int, float, np.integer, np.floating)):
        if pd.isna(value):
            return default
        return float(value)
    cleaned = str(value).strip()
    if not cleaned:
        return default
    negative = cleaned.startswith("(") and cleaned.endswith(")")
    cleaned = cleaned.replace(",", "")
    cleaned = cleaned.replace("Rs.", "").replace("Rs", "").replace("INR", "")
    cleaned = cleaned.replace("%", "")
    cleaned = re.sub(r"[^0-9.\-]", "", cleaned)
    if cleaned in {"", "-", ".", "-."}:
        return default
    try:
        result = float(cleaned)
    except ValueError:
        return default
    return -abs(result) if negative else result


def _safe_int(value: Any, default: int = 0) -> int:
    return int(round(_safe_float(value, default)))


def _safe_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    return str(value).strip().lower() in {"true", "1", "yes", "y"}


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def _extract_json_block(text: str) -> Dict[str, Any]:
    if not text:
        return {}
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return {}
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return {}


def _coerce_sanction_terms(raw_terms: Any) -> Dict[str, Any]:
    terms = raw_terms if isinstance(raw_terms, Mapping) else {}
    return {
        "limit": _safe_float(terms.get("limit"), None),
        "interest_rate": _safe_float(terms.get("interest_rate"), None),
        "tenor_months": _safe_int(terms.get("tenor_months"), 0) or None,
        "remaining_tenor_months": _safe_int(terms.get("remaining_tenor_months"), 0) or None,
        "moratorium_months": _safe_int(terms.get("moratorium_months"), 0),
        "installment_amount": _safe_float(
            terms.get("installment_amount") or terms.get("emi_amount") or terms.get("repayment_installment"),
            None,
        ),
        "principal_installment_amount": _safe_float(terms.get("principal_installment_amount"), None),
        "repayment_frequency": str(
            terms.get("repayment_frequency") or terms.get("installment_frequency") or "monthly"
        ).lower(),
        "balance_outstanding": _safe_float(
            terms.get("balance_outstanding") or terms.get("outstanding") or terms.get("outstanding_amount"),
            None,
        ),
        "annual_principal_due": _safe_float(terms.get("annual_principal_due"), None),
        "current_maturity_of_long_term_debt": _safe_float(
            terms.get("current_maturity_of_long_term_debt") or terms.get("cmltd"),
            None,
        ),
        "amortization_schedule_available": _safe_bool(terms.get("amortization_schedule_available")),
    }


def _validate_financial_extraction(
    payload: Mapping[str, Any],
    *,
    raw_text: str = "",
    default_document_type: str = "unknown",
) -> Dict[str, Any]:
    normalized: Dict[str, Any] = {field: None for field in FINANCIAL_FIELDS}
    for field in FINANCIAL_FIELDS:
        if field in payload:
            normalized[field] = _safe_float(payload.get(field), None)

    normalized["document_type"] = str(payload.get("document_type") or default_document_type)
    normalized["document_summary"] = str(payload.get("document_summary") or "").strip()
    normalized["board_resolution_present"] = _safe_bool(payload.get("board_resolution_present"))
    normalized["credit_rating"] = payload.get("credit_rating")
    normalized["sanction_terms"] = _coerce_sanction_terms(payload.get("sanction_terms") or {})
    normalized["raw_text"] = (raw_text or str(payload.get("raw_text") or ""))[:8000]
    normalized["extraction_warnings"] = list(payload.get("extraction_warnings") or [])
    return normalized


def _gemini_endpoint() -> str:
    return f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"


def _request_gemini_json(
    prompt: str,
    *,
    file_bytes: bytes | None = None,
    text_context: str | None = None,
) -> Dict[str, Any]:
    if not GEMINI_API_KEY:
        return {}

    parts: List[Dict[str, Any]] = [{"text": prompt}]
    if text_context:
        parts.append({"text": text_context[:12000]})
    if file_bytes:
        parts.append(
            {
                "inline_data": {
                    "mime_type": "application/pdf",
                    "data": base64.b64encode(file_bytes).decode("utf-8"),
                }
            }
        )

    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"},
    }
    try:
        response = httpx.post(_gemini_endpoint(), json=payload, timeout=GEMINI_TIMEOUT_SEC)
        response.raise_for_status()
        body = response.json()
        text_parts = body.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        combined = "\n".join(part.get("text", "") for part in text_parts)
        return _extract_json_block(combined)
    except Exception:
        return {}


def _extract_text_from_pdf(file_bytes: bytes) -> str:
    text_chunks: List[str] = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            if page_text:
                text_chunks.append(page_text)
            for table in page.extract_tables() or []:
                rows = [" ".join(str(cell) for cell in row if cell is not None) for row in table if row]
                if rows:
                    text_chunks.append("\n".join(rows))
    return "\n".join(text_chunks)


def _detect_document_type(text: str) -> str:
    lower_text = (text or "").lower()
    if any(token in lower_text for token in ["sanction letter", "facility letter", "credit sanction"]):
        return "sanction_letter"
    if any(token in lower_text for token in ["board meeting", "board resolution", "resolved that"]):
        return "board_minutes"
    if any(token in lower_text for token in ["rating rationale", "credit rating", "brickwork", "care ratings", "crisll", "icra"]):
        return "rating_report"
    if any(token in lower_text for token in ["income tax return", "itr-", "form no. itr", "assessment year", "return of income"]):
        return "itr"
    if any(token in lower_text for token in ["shareholding pattern", "promoter holding", "category of shareholders", "public shareholding"]):
        return "shareholding_pattern"
    if any(token in lower_text for token in ["gstr-3b", "gstr-1", "gstr-2a", "gstr-2b", "goods and services tax", "gstin"]):
        return "gst_return"
    if any(token in lower_text for token in ["balance sheet", "statement of profit", "annual report"]):
        return "financial_statement"
    return "unstructured_document"


def _extract_fields_from_text(text: str) -> Dict[str, Any]:
    cleaned_text = text or ""
    extracted: Dict[str, Any] = {field: None for field in FINANCIAL_FIELDS}
    for field, patterns in FIELD_PATTERNS.items():
        for pattern in patterns:
            match = re.search(pattern, cleaned_text, re.IGNORECASE)
            if match:
                extracted[field] = _safe_float(match.group(1), None)
                break

    limit_match = re.search(r"(?:limit|facility)\s*(?:of)?\s*(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)", cleaned_text, re.IGNORECASE)
    interest_match = re.search(r"(?:interest\s+rate|roi)[:\s]+([\d.]+)", cleaned_text, re.IGNORECASE)
    tenor_match = re.search(r"(?:tenor|repayment\s+period)[:\s]+([\d]+)", cleaned_text, re.IGNORECASE)
    installment_match = re.search(r"(?:emi|installment)[:\s]+(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)", cleaned_text, re.IGNORECASE)

    lines = [line.strip() for line in cleaned_text.splitlines() if line.strip()]
    extracted["document_type"] = _detect_document_type(cleaned_text)
    extracted["board_resolution_present"] = any(
        phrase in cleaned_text.lower() for phrase in ["resolved that", "board of directors", "board resolution"]
    )
    extracted["document_summary"] = " ".join(lines[:5])[:1200]
    extracted["sanction_terms"] = {
        "limit": _safe_float(limit_match.group(1), None) if limit_match else None,
        "interest_rate": _safe_float(interest_match.group(1), None) if interest_match else None,
        "tenor_months": _safe_int(tenor_match.group(1), 0) if tenor_match else None,
        "installment_amount": _safe_float(installment_match.group(1), None) if installment_match else None,
    }
    extracted["raw_text"] = cleaned_text[:8000]
    return extracted


def _build_financial_extraction_prompt(document_type_hint: str, regex_hints: Optional[Dict[str, Any]] = None) -> str:
    base_prompt = (
        "You are an expert Indian credit analyst extracting underwriting data from "
        "scanned, messy Indian-context corporate PDFs. This is the PRIMARY extraction — "
        "be thorough. Parse complex tabular structures, nested headers, notes to accounts, "
        "and Schedule III format balance sheets. Return strict JSON only. Use null when "
        "data is genuinely unavailable. All monetary values should be in the same unit "
        "(Lakhs or Crores — state which in document_summary).\n\n"
    )

    # Type-specific extraction instructions
    type_instructions = {
        "itr": (
            "This is an Indian Income Tax Return (ITR). Extract: "
            "gross_total_income, total_deductions, taxable_income, tax_paid, "
            "return_type (ITR-1/2/3/4/5/6/7), assessment_year, "
            "business_income, capital_gains, tds_details. "
        ),
        "shareholding_pattern": (
            "This is a Shareholding Pattern document. Extract: "
            "promoter_holding_pct, institutional_holding_pct, public_holding_pct, "
            "total_shares, pledged_shares_pct, top_shareholders list. "
        ),
        "gst_return": (
            "This is a GST Return (GSTR-1/3B/2A/2B). Extract: "
            "gstr_type, return_period, total_taxable_outward_supplies, "
            "total_itc_claimed, total_tax_paid, gstin. "
        ),
    }

    extra_instruction = type_instructions.get(document_type_hint, "")

    schema = (
        "Schema: {"
        '"revenue": number|null, '
        '"net_income": number|null, '
        '"total_assets": number|null, '
        '"total_liabilities": number|null, '
        '"total_equity": number|null, '
        '"ebitda": number|null, '
        '"total_debt": number|null, '
        '"cash_and_equivalents": number|null, '
        '"operating_cash_flow": number|null, '
        '"depreciation": number|null, '
        '"interest_expense": number|null, '
        '"tax_expense": number|null, '
        '"current_assets": number|null, '
        '"current_liabilities": number|null, '
        '"accounts_receivable": number|null, '
        '"inventory": number|null, '
        '"document_type": string, '
        '"document_summary": string, '
        '"board_resolution_present": boolean, '
        '"credit_rating": string|null, '
        '"sanction_terms": {'
        '"limit": number|null, '
        '"interest_rate": number|null, '
        '"tenor_months": integer|null, '
        '"remaining_tenor_months": integer|null, '
        '"moratorium_months": integer|null, '
        '"installment_amount": number|null, '
        '"principal_installment_amount": number|null, '
        '"repayment_frequency": string|null, '
        '"balance_outstanding": number|null, '
        '"annual_principal_due": number|null, '
        '"current_maturity_of_long_term_debt": number|null, '
        '"amortization_schedule_available": boolean'
        '}, '
        '"extraction_confidence": number (0-1)'
        "}. "
    )

    hint_section = ""
    if regex_hints:
        non_null_hints = {k: v for k, v in regex_hints.items() if v is not None and k in FINANCIAL_FIELDS}
        if non_null_hints:
            hint_section = (
                f"\nA preliminary regex scan found these values — verify and correct them: "
                f"{json.dumps(non_null_hints)}\n"
            )

    return (
        base_prompt + extra_instruction + schema
        + f"Document type hint: {document_type_hint}."
        + hint_section
    )


def _invoke_gemini_vision_extraction(
    file_bytes: bytes,
    extracted_text: str,
    document_type_hint: str,
    regex_hints: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Primary Gemini Vision extraction — used for ALL document types."""
    payload = _request_gemini_json(
        _build_financial_extraction_prompt(document_type_hint, regex_hints),
        file_bytes=file_bytes,
        text_context=extracted_text,
    )
    return _validate_financial_extraction(
        payload,
        raw_text=extracted_text,
        default_document_type=document_type_hint,
    )


def get_databricks_connection():
    """Establish a connection to Databricks SQL Warehouse."""
    if sql is None:
        raise RuntimeError("databricks-sql connector is not installed")
    return sql.connect(
        server_hostname=DATABRICKS_SERVER_HOSTNAME,
        http_path=DATABRICKS_HTTP_PATH,
        access_token=DATABRICKS_ACCESS_TOKEN,
    )


def _row_to_dict(row: Any) -> Dict[str, Any]:
    if row is None:
        return {}
    if hasattr(row, "asDict"):
        return row.asDict()
    if isinstance(row, dict):
        return row
    return {key: getattr(row, key) for key in dir(row) if not key.startswith("_") and not callable(getattr(row, key))}


def fetch_gst_from_databricks(company_id: str, uploaded_gst_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Fetch structured GST filings with a multi-tier fallback strategy.

    Priority order:
    1. Real Databricks SQL Warehouse (if configured with valid credentials)
    2. Uploaded/extracted GST data from document ingestion
    3. Gemini LLM-based GST analysis (uses company context)
    4. Conservative empty defaults
    """
    result = {
        "gstr_3b_revenue": 0.0,
        "gstr_2a_itc_claimed": 0.0,
        "circular_trading_flag": False,
        "sales_inflation_risk": 0.0,
        "sales_inflation_gap": 0.0,
        "monthly_gst_sales": [],
        "gst_data_source": "not_available",
    }
    row = {}

    # --- Tier 1: Real Databricks connection ---
    databricks_configured = (
        DATABRICKS_SERVER_HOSTNAME
        and DATABRICKS_SERVER_HOSTNAME != "mock.cloud.databricks.com"
        and DATABRICKS_ACCESS_TOKEN
        and DATABRICKS_ACCESS_TOKEN != "mock-token"
    )
    if databricks_configured:
        try:
            with get_databricks_connection() as connection:
                with connection.cursor() as cursor:
                    safe_company_id = str(company_id).replace("'", "''")
                    cursor.execute(
                        f"SELECT * FROM credit_lakehouse.gst_filings WHERE company_id = '{safe_company_id}' LIMIT 1"
                    )
                    row = _row_to_dict(cursor.fetchone())
                    result["gst_data_source"] = "databricks"
        except Exception as exc:
            print(f"Databricks connection failed: {exc}")

    # --- Tier 2: Uploaded GST document data ---
    if not row and uploaded_gst_data:
        row = uploaded_gst_data
        result["gst_data_source"] = "uploaded_document"

    # --- Tier 3: Gemini LLM analysis ---
    if not row and GEMINI_API_KEY:
        gst_prompt = (
            "You are an Indian GST compliance analyst. For a corporate entity with "
            f"ID '{company_id}', provide realistic GST filing estimates. "
            "Return strict JSON: {\"gstr_3b_revenue\": number, "
            "\"gstr_2a_itc_claimed\": number, "
            "\"monthly_gst_sales\": [12 monthly numbers], "
            "\"filing_regularity\": \"Regular\" | \"Irregular\" | \"Delayed\", "
            "\"gst_risk_flags\": [string]}. "
            "If you cannot determine specifics, return conservative mid-range values "
            "for a typical Indian SME."
        )
        gemini_result = _request_gemini_json(gst_prompt)
        if gemini_result:
            row = gemini_result
            result["gst_data_source"] = "gemini_analysis"

    # --- Process whatever data source we got ---
    revenue = _safe_float(row.get("gstr_3b_revenue"))
    itc = _safe_float(row.get("gstr_2a_itc_claimed"))
    monthly_sales = row.get("monthly_sales") or row.get("monthly_gst_sales") or []
    if isinstance(monthly_sales, str):
        try:
            monthly_sales = json.loads(monthly_sales)
        except json.JSONDecodeError:
            monthly_sales = []

    # Circular trading detection: ITC claimed relative to revenue
    itc_revenue_ratio = (itc / max(revenue, 1.0)) if revenue > 0 else 0.0
    sales_gap = max(0.0, revenue - (itc * 1.5))
    sales_gap_pct = round((sales_gap / revenue) * 100, 2) if revenue > 0 else 0.0

    # Flag circular trading if ITC-to-revenue ratio is suspiciously high
    circular_flag = (
        bool(row.get("circular_trading_flag", False))
        or (itc > 0 and itc_revenue_ratio > 0.85)
    )

    result.update({
        "gstr_3b_revenue": revenue,
        "gstr_2a_itc_claimed": itc,
        "itc_revenue_ratio": round(itc_revenue_ratio, 4),
        "circular_trading_flag": circular_flag,
        "sales_inflation_risk": sales_gap_pct,
        "sales_inflation_gap": round(sales_gap, 2),
        "monthly_gst_sales": [round(_safe_float(value), 2) for value in monthly_sales],
        "filing_regularity": row.get("filing_regularity", "Unknown"),
        "gst_risk_flags": row.get("gst_risk_flags", []),
    })
    return result

def reconcile_gst_with_bank(gst_data: Dict[str, Any], bank_data: Dict[str, Any]) -> Dict[str, Any]:
    """Cross-leverage GST revenue with bank inflows to detect circular trading and sales inflation."""
    gst_revenue = _safe_float(gst_data.get("gstr_3b_revenue"))
    bank_inflows = _safe_float(bank_data.get("total_inflows") or bank_data.get("total_credits"))
    net_cash_flow = _safe_float(bank_data.get("net_cash_flow"))
    monthly_gst_sales = [float(value) for value in gst_data.get("monthly_gst_sales", []) if value is not None]
    monthly_bank_inflows = [float(value) for value in bank_data.get("monthly_inflows", []) if value is not None]

    bank_basis = bank_inflows if bank_inflows > 0 else max(net_cash_flow, 0.0)
    gap_amount = max(0.0, gst_revenue - bank_basis)
    gap_pct = round((gap_amount / gst_revenue) * 100, 2) if gst_revenue > 0 else 0.0
    correlation = 0.0
    if len(monthly_gst_sales) >= 2 and len(monthly_gst_sales) == len(monthly_bank_inflows):
        corr_value = float(np.corrcoef(monthly_gst_sales, monthly_bank_inflows)[0, 1])
        correlation = 0.0 if np.isnan(corr_value) else round(corr_value, 4)

    circular_trading_flag = bool(gst_data.get("circular_trading_flag", False))
    circular_trading_flag = circular_trading_flag or gap_pct > 30 or (correlation and correlation < 0.35)

    return {
        "bank_inflows_considered": round(bank_basis, 2),
        "gst_bank_gap": round(gap_amount, 2),
        "gst_bank_gap_pct": gap_pct,
        "gst_bank_correlation": correlation,
        "sales_inflation_risk": max(gap_pct, _safe_float(gst_data.get("sales_inflation_risk"))),
        "circular_trading_flag": circular_trading_flag,
    }


def parse_financial_pdf(file_bytes: bytes) -> Dict[str, Any]:
    """Extract financial and underwriting-relevant data from PDFs.

    **Gemini Vision is the PRIMARY extraction engine for ALL document types.**
    Regex is used only as a fast pre-scan to provide hints to the LLM,
    improving extraction accuracy without being the gatekeeper.

    This approach handles:
    - Messy, scanned Indian-context PDFs
    - Complex Schedule III balance sheets
    - ITR (Income Tax Returns)
    - Shareholding patterns
    - GST returns
    - Board minutes, sanction letters, rating reports
    """
    try:
        raw_text = _extract_text_from_pdf(file_bytes)
    except Exception:
        raw_text = ""

    document_type = _detect_document_type(raw_text)
    text_too_short = len(_normalize_text(raw_text)) < 200

    # ── Step 1: Quick regex pre-scan for hints (not authoritative) ────────
    regex_hints: Dict[str, Any] = {}
    if raw_text and not text_too_short:
        regex_raw = _extract_fields_from_text(raw_text)
        regex_hints = {k: v for k, v in regex_raw.items() if k in FINANCIAL_FIELDS and v is not None}

    # ── Step 2: Gemini Vision — PRIMARY extraction ────────────────────────
    gemini_extract = _invoke_gemini_vision_extraction(
        file_bytes, raw_text, document_type, regex_hints=regex_hints,
    )

    # ── Step 3: Merge — Gemini takes priority, regex fills gaps ───────────
    if gemini_extract:
        # Start with regex hints, overlay Gemini (Gemini wins on conflicts)
        merged_data = {**regex_hints}
        for k, v in gemini_extract.items():
            if v not in (None, "", {}):
                merged_data[k] = v
        merged = _validate_financial_extraction(
            merged_data,
            raw_text=raw_text or gemini_extract.get("raw_text", ""),
            default_document_type=document_type,
        )
        merged["document_type"] = gemini_extract.get("document_type") or document_type
        merged["extraction_status"] = "gemini_primary"
        merged["extraction_confidence"] = gemini_extract.get("extraction_confidence", 0.8)
    else:
        # Gemini unavailable — fall back to regex-only
        native_extract = _validate_financial_extraction(
            _extract_fields_from_text(raw_text),
            raw_text=raw_text,
            default_document_type=document_type,
        )
        merged = native_extract
        merged["document_type"] = document_type
        merged["extraction_status"] = "regex_fallback"
        merged["extraction_confidence"] = 0.3
        merged.setdefault("extraction_warnings", []).append("gemini_unavailable_regex_only")

    populated_numeric = sum(
        1 for f in FINANCIAL_FIELDS if merged.get(f) is not None
    )
    if populated_numeric == 0 and not merged.get("document_summary"):
        raise ValueError("Unable to extract usable content from PDF document")

    if merged.get("revenue") is None:
        merged.setdefault("extraction_warnings", []).append("revenue_not_found")
    if not merged.get("sanction_terms", {}).get("amortization_schedule_available"):
        merged.setdefault("extraction_warnings", []).append("amortization_schedule_missing")
    return merged


def _find_column(columns: Iterable[str], keywords: Sequence[str]) -> Optional[str]:
    normalized = {str(column).strip().lower(): column for column in columns}
    for keyword in keywords:
        for lowered, original in normalized.items():
            if keyword in lowered:
                return original
    return None


def _batch_records(items: Sequence[Mapping[str, Any]], batch_size: int) -> Iterable[List[Mapping[str, Any]]]:
    for start in range(0, len(items), batch_size):
        yield list(items[start : start + batch_size])


def _build_transaction_classification_prompt(records: Sequence[Mapping[str, Any]]) -> str:
    return (
        'Classify Indian bank statement transactions for a corporate underwriting model. '
        'Return strict JSON with key "transactions" containing a list of objects with fields: '
        '"row_id" (integer), '
        '"category" (one of customer_receipt, gateway_settlement, vendor_payment, tax_payment, salary_credit, '
        'cash_deposit, cash_withdrawal, internal_transfer, loan_repayment, emi_bounce, chargeback, bank_charge, other, uncategorized), '
        '"payment_gateway" (one of razorpay, billdesk, payu, cashfree, phonepe, paytm, bharatpe, bank_transfer, none, unknown), '
        '"is_emi_bounce" (boolean), '
        '"is_revenue_inflow" (boolean), '
        '"is_cyclical_revenue" (boolean), '
        '"confidence" (number between 0 and 1). '
        'Use description, debit, credit, amount sign, and context. '
        f'Transactions: {json.dumps(records)}'
    )


def _normalize_transaction_classifications(
    payload: Mapping[str, Any],
    records: Sequence[Mapping[str, Any]],
) -> Dict[int, Dict[str, Any]]:
    defaults = {
        int(record["row_id"]): {
            "category": "uncategorized",
            "payment_gateway": "unknown",
            "is_emi_bounce": False,
            "is_revenue_inflow": False,
            "is_cyclical_revenue": False,
            "confidence": 0.0,
        }
        for record in records
    }
    for item in payload.get("transactions", []):
        try:
            row_id = int(item.get("row_id"))
        except Exception:
            continue
        if row_id not in defaults:
            continue
        category = str(item.get("category") or "uncategorized").lower()
        gateway = str(item.get("payment_gateway") or "unknown").lower()
        defaults[row_id] = {
            "category": category if category in ALLOWED_TRANSACTION_CATEGORIES else "uncategorized",
            "payment_gateway": gateway if gateway in ALLOWED_PAYMENT_GATEWAYS else "unknown",
            "is_emi_bounce": _safe_bool(item.get("is_emi_bounce")),
            "is_revenue_inflow": _safe_bool(item.get("is_revenue_inflow")),
            "is_cyclical_revenue": _safe_bool(item.get("is_cyclical_revenue")),
            "confidence": max(0.0, min(1.0, _safe_float(item.get("confidence"), 0.0))),
        }
    return defaults


def _categorize_transactions_with_gemini(records: Sequence[Mapping[str, Any]]) -> Tuple[Dict[int, Dict[str, Any]], str]:
    all_classifications: Dict[int, Dict[str, Any]] = {}
    service_status = "available"
    for batch in _batch_records(records, BANK_CATEGORY_BATCH_SIZE):
        payload = _request_gemini_json(_build_transaction_classification_prompt(batch))
        normalized = _normalize_transaction_classifications(payload, batch)
        if not payload:
            service_status = "service_unavailable"
        all_classifications.update(normalized)
    return all_classifications, service_status


def _infer_min_balance_threshold(daily_balances: pd.Series) -> float:
    if daily_balances.empty:
        return 0.0
    median_balance = float(daily_balances.median())
    if median_balance >= 100000:
        return 25000.0
    if median_balance >= 50000:
        return 10000.0
    if median_balance >= 20000:
        return 5000.0
    if median_balance >= 10000:
        return 2500.0
    return 1000.0


def _parse_statement_dataframe(df: pd.DataFrame) -> Dict[str, Any]:
    working = df.copy()
    working.columns = [str(column).strip() for column in working.columns]

    date_col = _find_column(working.columns, ["date", "txn date", "transaction date", "value date"])
    desc_col = _find_column(working.columns, ["description", "narration", "remarks", "particular", "details"])
    credit_col = _find_column(working.columns, ["credit", "deposit", "cr amount"])
    debit_col = _find_column(working.columns, ["debit", "withdrawal", "dr amount"])
    amount_col = _find_column(working.columns, ["amount", "transaction amount"])
    balance_col = _find_column(working.columns, ["balance", "closing bal", "available balance"])

    if not any([credit_col, debit_col, amount_col]):
        raise ValueError("Bank statement CSV does not contain amount columns")

    parsed = pd.DataFrame()
    parsed["row_id"] = range(len(working))
    parsed["txn_date"] = pd.to_datetime(working[date_col], errors="coerce", dayfirst=True) if date_col else pd.NaT
    parsed["description"] = working[desc_col].fillna("") if desc_col else ""
    parsed["credit"] = working[credit_col].apply(_safe_float) if credit_col else 0.0
    parsed["debit"] = working[debit_col].apply(_safe_float) if debit_col else 0.0
    parsed["amount"] = working[amount_col].apply(_safe_float) if amount_col else 0.0
    parsed["balance"] = working[balance_col].apply(_safe_float) if balance_col else np.nan

    if amount_col and not credit_col and not debit_col:
        parsed["credit"] = parsed["amount"].apply(lambda value: value if value > 0 else 0.0)
        parsed["debit"] = parsed["amount"].apply(lambda value: abs(value) if value < 0 else 0.0)
    elif amount_col:
        unresolved = (parsed["credit"] == 0) & (parsed["debit"] == 0)
        parsed.loc[unresolved, "credit"] = parsed.loc[unresolved, "amount"].apply(lambda value: value if value > 0 else 0.0)
        parsed.loc[unresolved, "debit"] = parsed.loc[unresolved, "amount"].apply(lambda value: abs(value) if value < 0 else 0.0)

    if parsed["txn_date"].notna().any():
        parsed = parsed.sort_values(["txn_date", "row_id"]).reset_index(drop=True)

    classification_input = [
        {
            "row_id": int(row.row_id),
            "description": str(row.description)[:220],
            "credit": round(float(row.credit), 2),
            "debit": round(float(row.debit), 2),
            "amount": round(float(row.amount), 2),
        }
        for row in parsed.itertuples(index=False)
    ]
    classification_map, service_status = _categorize_transactions_with_gemini(classification_input)
    parsed["category"] = parsed["row_id"].map(lambda idx: classification_map.get(int(idx), {}).get("category", "uncategorized"))
    parsed["payment_gateway"] = parsed["row_id"].map(
        lambda idx: classification_map.get(int(idx), {}).get("payment_gateway", "unknown")
    )
    parsed["is_emi_bounce"] = parsed["row_id"].map(
        lambda idx: classification_map.get(int(idx), {}).get("is_emi_bounce", False)
    )
    parsed["is_revenue_inflow"] = parsed["row_id"].map(
        lambda idx: classification_map.get(int(idx), {}).get("is_revenue_inflow", False)
    )
    parsed["is_cyclical_revenue"] = parsed["row_id"].map(
        lambda idx: classification_map.get(int(idx), {}).get("is_cyclical_revenue", False)
    )
    parsed["classification_confidence"] = parsed["row_id"].map(
        lambda idx: classification_map.get(int(idx), {}).get("confidence", 0.0)
    )

    total_inflows = float(parsed["credit"].sum())
    total_outflows = float(parsed["debit"].sum())
    net_cash_flow = total_inflows - total_outflows

    monthly = pd.DataFrame()
    if parsed["txn_date"].notna().any():
        monthly = (
            parsed.dropna(subset=["txn_date"])
            .assign(month=lambda frame: frame["txn_date"].dt.to_period("M").astype(str))
            .groupby("month", as_index=False)
            .agg(inflows=("credit", "sum"), outflows=("debit", "sum"))
        )
        monthly["net_flow"] = monthly["inflows"] - monthly["outflows"]

    monthly_inflows = [round(value, 2) for value in monthly.get("inflows", pd.Series(dtype=float)).tolist()]
    monthly_outflows = [round(value, 2) for value in monthly.get("outflows", pd.Series(dtype=float)).tolist()]
    monthly_flows = [round(value, 2) for value in monthly.get("net_flow", pd.Series(dtype=float)).tolist()]

    stability = 0.0
    if monthly_flows:
        mean_flow = float(np.mean(np.abs(monthly_flows)))
        if mean_flow > 0:
            stability = max(0.0, 1.0 - min(float(np.std(monthly_flows)) / mean_flow, 1.0))

    balance_points = parsed.dropna(subset=["txn_date", "balance"]).groupby("txn_date")["balance"].last().sort_index()
    average_daily_balance = 0.0
    min_balance_threshold = 0.0
    min_balance_violations = 0
    if not balance_points.empty:
        daily_index = pd.date_range(balance_points.index.min(), balance_points.index.max(), freq="D")
        daily_balances = balance_points.reindex(daily_index).ffill().bfill()
        average_daily_balance = float(daily_balances.mean())
        min_balance_threshold = _infer_min_balance_threshold(daily_balances)
        min_balance_violations = int((daily_balances < min_balance_threshold).sum())

    category_summary: Dict[str, Dict[str, Any]] = {}
    for category, rows in parsed.groupby("category"):
        category_summary[category] = {
            "count": int(len(rows)),
            "credits": round(float(rows["credit"].sum()), 2),
            "debits": round(float(rows["debit"].sum()), 2),
        }

    gateway_summary = {
        gateway: {"count": int(len(rows)), "credits": round(float(rows["credit"].sum()), 2)}
        for gateway, rows in parsed.groupby("payment_gateway")
    }

    cyclical_revenue_inflows = float(parsed.loc[parsed["is_cyclical_revenue"], "credit"].sum())
    cyclical_revenue_ratio = (cyclical_revenue_inflows / total_inflows) if total_inflows > 0 else 0.0
    categorization_confidence = float(parsed["classification_confidence"].mean()) if len(parsed) else 0.0

    bounce_count = int((parsed["category"].isin(["emi_bounce", "chargeback"])).sum())
    emi_bounce_count = int(parsed["is_emi_bounce"].sum())

    return {
        "total_inflows": round(total_inflows, 2),
        "total_outflows": round(total_outflows, 2),
        "total_credits": round(total_inflows, 2),
        "total_debits": round(total_outflows, 2),
        "net_cash_flow": round(net_cash_flow, 2),
        "num_transactions": int(len(parsed)),
        "avg_monthly_flow": round(float(np.mean(monthly_flows)) if monthly_flows else 0.0, 2),
        "cash_flow_stability": round(stability, 4),
        "average_daily_balance": round(average_daily_balance, 2),
        "min_balance_threshold": round(min_balance_threshold, 2),
        "min_balance_violations": min_balance_violations,
        "bounce_count": bounce_count,
        "emi_bounce_count": emi_bounce_count,
        "monthly_inflows": monthly_inflows,
        "monthly_outflows": monthly_outflows,
        "monthly_flows": monthly_flows,
        "category_summary": category_summary,
        "payment_gateway_summary": gateway_summary,
        "cyclical_revenue_ratio": round(cyclical_revenue_ratio, 4),
        "cyclical_revenue_flag": cyclical_revenue_ratio >= 0.4,
        "categorization_confidence_score": round(categorization_confidence, 4),
        "categorization_service_status": service_status,
    }


def parse_bank_statement_csv(file_bytes: bytes) -> Dict[str, Any]:
    """Parse bank statement CSV for transaction-level cash flow analysis."""
    try:
        dataframe = pd.read_csv(io.BytesIO(file_bytes))
    except Exception as exc:
        raise ValueError(f"CSV parsing failed: {exc}") from exc
    if dataframe.empty:
        raise ValueError("Bank statement CSV is empty.")
    return _parse_statement_dataframe(dataframe)

def _iter_account_candidates(payload: Any) -> Iterable[Dict[str, Any]]:
    stack = [payload]
    while stack:
        current = stack.pop()
        if isinstance(current, dict):
            lowered_keys = {str(key).lower() for key in current.keys()}
            if lowered_keys & {
                "dpd",
                "dpd_history",
                "paymenthistory",
                "dayspastdue",
                "accountnumber",
                "account_number",
                "currentbalance",
                "current_balance",
                "lender",
                "membername",
            }:
                yield current
            stack.extend(current.values())
        elif isinstance(current, list):
            stack.extend(current)


def _parse_dpd_history(raw_value: Any) -> List[int]:
    mapping = {
        "std": 0,
        "sma0": 1,
        "sma-0": 1,
        "sma1": 31,
        "sma-1": 31,
        "sma2": 61,
        "sma-2": 61,
        "sub": 91,
        "dbt": 120,
        "lss": 180,
        "loss": 180,
        "xxx": 0,
    }
    if raw_value is None:
        return []
    if isinstance(raw_value, list):
        history: List[int] = []
        for item in raw_value:
            history.extend(_parse_dpd_history(item))
        return history
    if isinstance(raw_value, dict):
        history: List[int] = []
        for item in raw_value.values():
            history.extend(_parse_dpd_history(item))
        return history

    tokens = re.split(r"[^A-Za-z0-9\-]+", str(raw_value))
    history = []
    for token in tokens:
        token = token.strip().lower()
        if not token:
            continue
        if token in mapping:
            history.append(mapping[token])
        elif token.isdigit():
            history.append(int(token))
    return history


def _classify_sma(max_dpd: int) -> str:
    if max_dpd > 90:
        return "npa"
    if max_dpd > 60:
        return "sma_2"
    if max_dpd > 30:
        return "sma_1"
    if max_dpd > 0:
        return "sma_0"
    return "standard"


def _recursive_flag_search(payload: Any, needles: List[str]) -> bool:
    if isinstance(payload, dict):
        for key, value in payload.items():
            key_text = str(key).lower()
            if any(needle in key_text for needle in needles):
                if isinstance(value, bool):
                    return value
                if str(value).lower() in {"true", "yes", "y", "1"}:
                    return True
            if _recursive_flag_search(value, needles):
                return True
    elif isinstance(payload, list):
        return any(_recursive_flag_search(item, needles) for item in payload)
    elif isinstance(payload, str):
        lower_value = payload.lower()
        return any(needle in lower_value for needle in needles)
    return False


_CMR_TO_EQUIVALENT_SCORE: Dict[int, int] = {
    1: 900,   # CMR-1: Lowest risk (equivalent to excellent retail CIBIL)
    2: 850,
    3: 800,
    4: 750,
    5: 700,
    6: 650,
    7: 580,
    8: 500,
    9: 420,
    10: 350,  # CMR-10: Highest risk
}


def _detect_bureau_score_type(
    data: Dict[str, Any],
) -> Tuple[int, str, Optional[int]]:
    """Detect whether bureau data contains a Commercial CIBIL (CMR) or Retail CIBIL score.

    Indian Commercial/Corporate CIBIL reports use CMR (CIBIL MSME Rank)
    which ranges from 1–10 (where CMR-1 is the best). This is fundamentally
    different from Retail CIBIL scores (300–900).

    Returns:
        (equivalent_score, score_type, raw_cmr_rank)
        - equivalent_score: normalised to 300-900 scale for downstream compatibility
        - score_type: 'cmr', 'retail_cibil', or 'not_available'
        - raw_cmr_rank: original CMR rank (1-10) if applicable, else None
    """
    # Check for explicit CMR rank fields
    cmr_rank = (
        data.get("cmr_rank")
        or data.get("cmr")
        or data.get("cibil_msme_rank")
        or data.get("commercial_rank")
        or data.get("CMR")
        or data.get("CIBIL_MSME_Rank")
    )
    if cmr_rank is not None:
        rank_int = _safe_int(cmr_rank)
        if 1 <= rank_int <= 10:
            return _CMR_TO_EQUIVALENT_SCORE.get(rank_int, 650), "cmr", rank_int

    # Check for raw score fields
    raw_score = (
        data.get("score")
        or data.get("bureau_score")
        or data.get("cibil_score")
    )
    if raw_score is not None:
        score_int = _safe_int(raw_score)
        # If the value is 1-10, it's likely a CMR rank misplaced in a score field
        if 1 <= score_int <= 10:
            return _CMR_TO_EQUIVALENT_SCORE.get(score_int, 650), "cmr", score_int
        # Standard retail CIBIL range
        if 300 <= score_int <= 900:
            return score_int, "retail_cibil", None
        # Value outside known ranges — treat as retail but flag it
        if score_int > 0:
            return min(max(score_int, 300), 900), "retail_cibil", None

    # Check if data structure suggests a commercial report
    is_commercial = any(
        key.lower() in {
            "cmr", "cmr_rank", "commercial_report", "commercial",
            "msme_rank", "cibil_msme_rank", "borrower_category",
        }
        for key in data.keys()
    )
    if is_commercial:
        # Commercial report without a parseable score
        return 650, "cmr", None

    # No score found at all — conservative default with warning
    return 650, "not_available", None


def parse_bureau_json(data: Dict[str, Any]) -> Dict[str, Any]:
    """Parse bureau data and extract delinquency trajectories for commercial underwriting.

    Correctly handles both:
    - Retail CIBIL scores (300-900 range)
    - Commercial CIBIL / CMR ranks (1-10 range, where 1 = best)
    """
    tradelines = []
    utilization_values = []
    over_90_dpd_accounts = 0
    sma_0_accounts = 0
    sma_1_accounts = 0
    sma_2_accounts = 0
    npa_accounts = 0
    explicit_defaults = _safe_int(data.get("defaults") or data.get("num_past_defaults"))

    for account in _iter_account_candidates(data):
        dpd_history = _parse_dpd_history(
            account.get("dpd_history")
            or account.get("paymentHistory")
            or account.get("paymenthistory")
            or account.get("daysPastDue")
            or account.get("dayspastdue")
            or account.get("dpd")
        )
        last_12 = dpd_history[-12:]
        max_dpd = max(last_12) if last_12 else 0
        status = _classify_sma(max_dpd)
        if status == "sma_0":
            sma_0_accounts += 1
        elif status == "sma_1":
            sma_1_accounts += 1
        elif status == "sma_2":
            sma_2_accounts += 1
        elif status == "npa":
            npa_accounts += 1
        if max_dpd > 90:
            over_90_dpd_accounts += 1

        sanctioned = _safe_float(account.get("sanctioned_amount") or account.get("sanctionedAmount") or account.get("credit_limit"), 0.0)
        outstanding = _safe_float(account.get("current_balance") or account.get("currentBalance") or account.get("outstanding"), 0.0)
        if sanctioned > 0:
            utilization_values.append(min(outstanding / sanctioned, 1.0))

        tradelines.append(
            {
                "member_name": account.get("member_name") or account.get("memberName") or account.get("lender") or "Unknown",
                "account_number": account.get("account_number") or account.get("accountNumber") or account.get("accountnumber"),
                "dpd_array": last_12,
                "max_dpd_last_12_months": max_dpd,
                "sma_status": status,
                "outstanding": round(outstanding, 2),
            }
        )

    credit_history_months = _safe_int(data.get("credit_history_months") or data.get("creditHistoryMonths") or 60)

    # ── Issue 2 Fix: CMR vs Retail CIBIL detection ────────────────────────
    bureau_score, bureau_score_type, raw_cmr_rank = _detect_bureau_score_type(data)

    rbi_defaulter_flag = _recursive_flag_search(data, ["rbi defaulter", "rbi_defaulter", "defaulter list"])
    wilful_defaulter_flag = _recursive_flag_search(data, ["wilful defaulter", "willful defaulter", "wilful_defaulter"])

    result = {
        "bureau_score": bureau_score,
        "bureau_score_type": bureau_score_type,
        "num_past_defaults": max(explicit_defaults, over_90_dpd_accounts),
        "credit_history_months": credit_history_months,
        "active_loans": len(tradelines) or _safe_int(data.get("active_loans"), 0),
        "credit_utilization": round(float(np.mean(utilization_values)) if utilization_values else _safe_float(data.get("credit_utilization"), 0.0), 4),
        "tradelines": tradelines,
        "max_dpd_last_12_months": max((line["max_dpd_last_12_months"] for line in tradelines), default=0),
        "sma_0_accounts": sma_0_accounts,
        "sma_1_accounts": sma_1_accounts,
        "sma_2_accounts": sma_2_accounts,
        "npa_accounts": npa_accounts,
        "over_90_dpd_accounts": over_90_dpd_accounts,
        "rbi_defaulter_flag": rbi_defaulter_flag,
        "wilful_defaulter_flag": wilful_defaulter_flag,
    }

    # Add CMR-specific fields when applicable
    if raw_cmr_rank is not None:
        result["cmr_rank"] = raw_cmr_rank
        result["cmr_grade"] = (
            "Excellent" if raw_cmr_rank <= 2
            else "Good" if raw_cmr_rank <= 4
            else "Average" if raw_cmr_rank <= 6
            else "Below Average" if raw_cmr_rank <= 8
            else "Poor"
        )

    if bureau_score_type == "not_available":
        result["bureau_warnings"] = ["No bureau score or CMR rank found — using conservative default of 650"]

    return result


_REPAYMENT_FREQUENCY_MULTIPLIER: Dict[str, int] = {
    "monthly": 12,
    "quarterly": 4,
    "half-yearly": 2,
    "semi-annual": 2,
    "annual": 1,
    "yearly": 1,
    "bullet": 1,
}


def _infer_annual_principal_obligation(
    financials: Dict[str, Any],
    sanction_terms: Dict[str, Any],
) -> Dict[str, Any]:
    """Infer the annual principal repayment obligation via a multi-tier cascade.

    Priority order:
      1. Explicit CMLTD from sanction terms.
      2. Explicit ``annual_principal_due`` from sanction terms.
      3. ``installment_amount`` × repayment frequency (annualised).
      4. ``total_debt / max(remaining_tenor, tenor, 60 months) × 12`` as a
         conservative fallback, with a 15 % confidence penalty.

    Returns a dict with ``annual_principal``, ``cmltd_source``, and
    ``confidence_penalty`` (0.0 = high confidence, up to 0.15 = uncertain).
    """
    terms = sanction_terms or {}

    # Tier 1 – explicit CMLTD
    cmltd = _safe_float(
        terms.get("current_maturity_of_long_term_debt") or terms.get("cmltd"),
        0.0,
    )
    if cmltd > 0:
        return {
            "annual_principal": cmltd,
            "cmltd_source": "sanction_terms_cmltd",
            "confidence_penalty": 0.0,
        }

    # Tier 2 – annual_principal_due
    annual_principal = _safe_float(terms.get("annual_principal_due"), 0.0)
    if annual_principal > 0:
        return {
            "annual_principal": annual_principal,
            "cmltd_source": "sanction_terms_annual_principal_due",
            "confidence_penalty": 0.0,
        }

    # Tier 3 – installment × frequency
    installment = _safe_float(
        terms.get("installment_amount")
        or terms.get("principal_installment_amount"),
        0.0,
    )
    frequency = str(terms.get("repayment_frequency") or "monthly").lower()
    multiplier = _REPAYMENT_FREQUENCY_MULTIPLIER.get(frequency, 12)
    if installment > 0:
        return {
            "annual_principal": installment * multiplier,
            "cmltd_source": "installment_times_frequency",
            "confidence_penalty": 0.05,
        }

    # Tier 4 – conservative estimate from tenor
    total_debt = _safe_float(
        financials.get("total_debt") or financials.get("long_term_liab"), 0.0,
    )
    remaining = _safe_int(terms.get("remaining_tenor_months"), 0)
    tenor = _safe_int(terms.get("tenor_months"), 0)
    effective_months = max(remaining, tenor, 60)  # floor at 5 years
    est_principal = (total_debt / effective_months) * 12 if total_debt > 0 else 0.0
    return {
        "annual_principal": round(est_principal, 2),
        "cmltd_source": "estimated_from_tenor" if est_principal > 0 else "not_available",
        "confidence_penalty": 0.15,
    }


def compute_financial_ratios(
    financials: Dict[str, Any],
    bank_data: Dict[str, Any],
    bureau_data: Dict[str, Any],
    collateral_value: float,
    loan_amount: float,
    prev_year_revenue: Optional[float] = None,
    sanction_terms: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Compute all financial ratios needed for underwriting and ML models.

    The DSCR calculation infers the annual principal obligation from
    ``sanction_terms`` via :func:`_infer_annual_principal_obligation`
    rather than using a blanket ``total_debt × 10 %`` assumption.
    When amortization schedule data is missing the confidence score is
    penalised so that downstream models treat the DSCR as uncertain.
    """
    revenue = _safe_float(financials.get("revenue") or financials.get("operating_income"), 0.0)
    net_income = _safe_float(financials.get("net_income") or financials.get("net_profit"), 0.0)
    total_assets = _safe_float(
        financials.get("total_assets"),
        _safe_float(financials.get("current_assets"), 0.0)
        + _safe_float(financials.get("fixed_assets"), 0.0)
        + _safe_float(financials.get("intangible_assets"), 0.0),
    )
    total_liabilities = _safe_float(
        financials.get("total_liabilities"),
        _safe_float(financials.get("short_term_liab"), 0.0)
        + _safe_float(financials.get("long_term_liab"), 0.0)
        + _safe_float(financials.get("contingent_liab"), 0.0),
    )
    total_equity = _safe_float(financials.get("total_equity"), max(total_assets - total_liabilities, 0.0))
    total_debt = _safe_float(financials.get("total_debt") or financials.get("long_term_liab"), 0.0)
    interest_expense = _safe_float(financials.get("interest_expense"), max(total_debt * 0.09, 0.0))
    depreciation = _safe_float(financials.get("depreciation"), 0.0)
    tax_expense = _safe_float(financials.get("tax_expense"), 0.0)
    ebitda = _safe_float(financials.get("ebitda"), 0.0)
    if ebitda <= 0 and net_income:
        ebitda = net_income + interest_expense + tax_expense + depreciation

    avg_monthly_flow = _safe_float(bank_data.get("avg_monthly_flow"), 0.0)
    cash_flow = _safe_float(financials.get("operating_cash_flow"), avg_monthly_flow * 12)
    if cash_flow == 0:
        cash_flow = _safe_float(bank_data.get("net_cash_flow"), 0.0)

    # ── DSCR: infer principal repayment from sanction terms ───────────────
    principal_info = _infer_annual_principal_obligation(
        financials, sanction_terms or financials.get("sanction_terms") or {},
    )
    annual_debt_service = interest_expense + principal_info["annual_principal"]

    revenue_growth = ((revenue - prev_year_revenue) / prev_year_revenue) if prev_year_revenue and prev_year_revenue > 0 else 0.0
    ebitda_margin = (ebitda / revenue) if revenue > 0 else 0.0
    debt_equity = (total_debt / total_equity) if total_equity > 0 else 10.0
    dscr = (cash_flow / annual_debt_service) if annual_debt_service > 0 else 0.0
    collateral_coverage = (collateral_value / loan_amount) if loan_amount > 0 else 0.0
    current_assets = _safe_float(financials.get("current_assets"), 0.0)
    current_liabilities = _safe_float(financials.get("current_liabilities") or financials.get("short_term_liab"), 0.0)

    return {
        "revenue": round(revenue, 2),
        "revenue_growth": round(revenue_growth, 4),
        "ebitda": round(ebitda, 2),
        "ebitda_margin": round(ebitda_margin, 4),
        "total_assets": round(total_assets, 2),
        "total_liabilities": round(total_liabilities, 2),
        "total_debt": round(total_debt, 2),
        "total_equity": round(total_equity, 2),
        "net_worth": round(total_equity, 2),
        "debt_equity_ratio": round(debt_equity, 4),
        "cash_flow": round(cash_flow, 2),
        "annual_debt_service": round(annual_debt_service, 2),
        "dscr": round(dscr, 4),
        "dscr_cmltd_source": principal_info["cmltd_source"],
        "dscr_confidence_penalty": principal_info["confidence_penalty"],
        "collateral_value": round(collateral_value, 2),
        "loan_amount_requested": round(loan_amount, 2),
        "collateral_coverage": round(collateral_coverage, 4),
        "bureau_score": bureau_data.get("bureau_score", 700),
        "num_past_defaults": bureau_data.get("num_past_defaults", 0),
        "cash_flow_stability": round(_safe_float(bank_data.get("cash_flow_stability"), 0.0), 4),
        "interest_expense": round(interest_expense, 2),
        "depreciation": round(depreciation, 2),
        "current_ratio": round((current_assets / current_liabilities) if current_liabilities > 0 else 1.5, 4),
        "average_daily_balance": round(_safe_float(bank_data.get("average_daily_balance"), 0.0), 2),
        "min_balance_violations": _safe_int(bank_data.get("min_balance_violations"), 0),
        "emi_bounce_count": _safe_int(bank_data.get("emi_bounce_count"), 0),
        "bounce_count": _safe_int(bank_data.get("bounce_count"), 0),
        "total_inflows": round(_safe_float(bank_data.get("total_inflows") or bank_data.get("total_credits"), 0.0), 2),
        "total_outflows": round(_safe_float(bank_data.get("total_outflows") or bank_data.get("total_debits"), 0.0), 2),
        "max_dpd_last_12_months": _safe_int(bureau_data.get("max_dpd_last_12_months"), 0),
        "sma_0_accounts": _safe_int(bureau_data.get("sma_0_accounts"), 0),
        "sma_1_accounts": _safe_int(bureau_data.get("sma_1_accounts"), 0),
        "sma_2_accounts": _safe_int(bureau_data.get("sma_2_accounts"), 0),
        "npa_accounts": _safe_int(bureau_data.get("npa_accounts"), 0),
        "rbi_defaulter_flag": bool(bureau_data.get("rbi_defaulter_flag", False)),
        "wilful_defaulter_flag": bool(bureau_data.get("wilful_defaulter_flag", False)),
    }

