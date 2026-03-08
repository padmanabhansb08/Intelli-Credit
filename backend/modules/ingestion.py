"""
Data Ingestion Module
Handles PDF parsing, bank statement analysis, bureau parsing, and financial ratio extraction.
"""
import base64
import io
import json
import os
import re
from typing import Any, Dict, Iterable, List, Optional

import httpx
import numpy as np
import pandas as pd
import pdfplumber
import pytesseract

try:
    from pdf2image import convert_from_bytes
except ImportError:
    convert_from_bytes = None

try:
    from databricks import sql
except ImportError:
    sql = None

DATABRICKS_SERVER_HOSTNAME = os.environ.get("DATABRICKS_SERVER_HOSTNAME", "mock.cloud.databricks.com")
DATABRICKS_HTTP_PATH = os.environ.get("DATABRICKS_HTTP_PATH", "sql/1.0/endpoints/mock")
DATABRICKS_ACCESS_TOKEN = os.environ.get("DATABRICKS_ACCESS_TOKEN", "mock-token")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")

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

BOUNCE_MARKERS = ["bounce", "bounced", "return", "returned", "rtn", "dishonour", "dishonor", "reject"]
EMI_MARKERS = ["emi", "ecs", "nach", "loan", "installment", "instalment"]


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


def _normalize_numeric_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    normalized = dict(payload)
    for field in FINANCIAL_FIELDS:
        if field in normalized:
            normalized[field] = _safe_float(normalized[field], None)
    if "sanction_terms" in normalized and isinstance(normalized["sanction_terms"], dict):
        for key in ("limit", "interest_rate", "tenor_months"):
            if key in normalized["sanction_terms"]:
                normalized["sanction_terms"][key] = _safe_float(normalized["sanction_terms"][key], None)
    return normalized


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


def _ocr_pdf(file_bytes: bytes) -> str:
    if convert_from_bytes is None:
        return ""
    images = convert_from_bytes(file_bytes)
    return "\n".join(pytesseract.image_to_string(image) for image in images)


def _detect_document_type(text: str) -> str:
    lower_text = (text or "").lower()
    if any(token in lower_text for token in ["sanction letter", "facility letter", "credit sanction"]):
        return "sanction_letter"
    if any(token in lower_text for token in ["board meeting", "board resolution", "resolved that"]):
        return "board_minutes"
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

    lines = [line.strip() for line in cleaned_text.splitlines() if line.strip()]
    extracted["document_type"] = _detect_document_type(cleaned_text)
    extracted["board_resolution_present"] = any(
        phrase in cleaned_text.lower() for phrase in ["resolved that", "board of directors", "board resolution"]
    )
    extracted["document_summary"] = " ".join(lines[:5])[:1200]
    extracted["sanction_terms"] = {
        "limit": _safe_float(re.search(r"(?:limit|facility)\s*(?:of)?\s*(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)", cleaned_text, re.IGNORECASE).group(1), None)
        if re.search(r"(?:limit|facility)\s*(?:of)?\s*(?:rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)", cleaned_text, re.IGNORECASE)
        else None,
        "interest_rate": _safe_float(re.search(r"(?:interest\s+rate|roi)[:\s]+([\d.]+)", cleaned_text, re.IGNORECASE).group(1), None)
        if re.search(r"(?:interest\s+rate|roi)[:\s]+([\d.]+)", cleaned_text, re.IGNORECASE)
        else None,
        "tenor_months": _safe_float(re.search(r"(?:tenor|repayment\s+period)[:\s]+([\d]+)", cleaned_text, re.IGNORECASE).group(1), None)
        if re.search(r"(?:tenor|repayment\s+period)[:\s]+([\d]+)", cleaned_text, re.IGNORECASE)
        else None,
    }
    extracted["raw_text"] = cleaned_text[:8000]
    return extracted


def _invoke_gemini_vision_fallback(file_bytes: bytes, extracted_text: str) -> Dict[str, Any]:
    if not GEMINI_API_KEY:
        return {}
    prompt = (
        "Extract Indian credit underwriting data from this PDF. "
        "Return strict JSON with keys: revenue, net_income, total_assets, total_liabilities, total_equity, "
        "ebitda, total_debt, cash_and_equivalents, operating_cash_flow, depreciation, interest_expense, "
        "tax_expense, current_assets, current_liabilities, accounts_receivable, inventory, document_type, "
        "document_summary, board_resolution_present, sanction_terms. Use null when unavailable."
    )
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {"text": extracted_text[:12000]},
                    {
                        "inline_data": {
                            "mime_type": "application/pdf",
                            "data": base64.b64encode(file_bytes).decode("utf-8"),
                        }
                    },
                ]
            }
        ]
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    try:
        response = httpx.post(url, json=payload, timeout=45.0)
        response.raise_for_status()
        data = response.json()
        parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        combined = "\n".join(part.get("text", "") for part in parts)
        return _normalize_numeric_payload(_extract_json_block(combined))
    except Exception:
        return {}


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


def fetch_gst_from_databricks(company_id: str) -> Dict[str, Any]:
    """Fetch structured GST filings from Databricks Data Lakehouse."""
    result = {
        "gstr_3b_revenue": 0.0,
        "gstr_2a_itc_claimed": 0.0,
        "circular_trading_flag": False,
        "sales_inflation_risk": 0.0,
        "sales_inflation_gap": 0.0,
        "monthly_gst_sales": [],
    }
    try:
        with get_databricks_connection() as connection:
            with connection.cursor() as cursor:
                safe_company_id = str(company_id).replace("'", "''")
                cursor.execute(
                    f"SELECT * FROM credit_lakehouse.gst_filings WHERE company_id = '{safe_company_id}' LIMIT 1"
                )
                row = _row_to_dict(cursor.fetchone())
    except Exception as exc:
        print(f"Databricks connection failed. Falling back to empty GST payload. Error: {exc}")
        row = {}

    revenue = _safe_float(row.get("gstr_3b_revenue"))
    itc = _safe_float(row.get("gstr_2a_itc_claimed"))
    monthly_sales = row.get("monthly_sales") or row.get("monthly_gst_sales") or []
    if isinstance(monthly_sales, str):
        try:
            monthly_sales = json.loads(monthly_sales)
        except json.JSONDecodeError:
            monthly_sales = []

    sales_gap = max(0.0, revenue - (itc * 1.5))
    sales_gap_pct = round((sales_gap / revenue) * 100, 2) if revenue > 0 else 0.0
    result.update(
        {
            "gstr_3b_revenue": revenue,
            "gstr_2a_itc_claimed": itc,
            "circular_trading_flag": bool(row.get("circular_trading_flag", False)) or (itc > 0 and itc / max(revenue, 1.0) > 0.85),
            "sales_inflation_risk": sales_gap_pct,
            "sales_inflation_gap": round(sales_gap, 2),
            "monthly_gst_sales": [round(_safe_float(value), 2) for value in monthly_sales],
        }
    )
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
    """Extract financial and underwriting-relevant data from PDFs."""
    extracted = {field: None for field in FINANCIAL_FIELDS}
    extracted.update(
        {
            "document_type": "unknown",
            "document_summary": "",
            "board_resolution_present": False,
            "sanction_terms": {},
            "raw_text": "",
            "extraction_status": "failed",
            "extraction_warnings": [],
        }
    )

    try:
        primary_text = _extract_text_from_pdf(file_bytes)
    except Exception as exc:
        primary_text = ""
        extracted["extraction_warnings"].append(f"native_pdf_parse_failed: {exc}")

    if primary_text:
        native_extract = _extract_fields_from_text(primary_text)
        extracted.update({key: value for key, value in native_extract.items() if value not in (None, "", {})})
        extracted["raw_text"] = primary_text[:8000]

    populated_numeric = sum(1 for field in FINANCIAL_FIELDS if extracted.get(field) is not None)
    ocr_text = ""
    if populated_numeric < 4:
        try:
            ocr_text = _ocr_pdf(file_bytes)
        except Exception as exc:
            extracted["extraction_warnings"].append(f"ocr_failed: {exc}")
            ocr_text = ""
        if ocr_text:
            ocr_extract = _extract_fields_from_text(ocr_text)
            for key, value in ocr_extract.items():
                if extracted.get(key) in (None, "", {}) and value not in (None, "", {}):
                    extracted[key] = value
            if not extracted.get("raw_text"):
                extracted["raw_text"] = ocr_text[:8000]

    populated_numeric = sum(1 for field in FINANCIAL_FIELDS if extracted.get(field) is not None)
    if populated_numeric < 4 or extracted.get("document_type") in {"sanction_letter", "board_minutes", "unstructured_document"}:
        gemini_data = _invoke_gemini_vision_fallback(file_bytes, f"{primary_text}\n{ocr_text}".strip())
        for key, value in gemini_data.items():
            if extracted.get(key) in (None, "", {}) and value not in (None, "", {}):
                extracted[key] = value

    if not extracted.get("document_summary") and extracted.get("raw_text"):
        lines = [line.strip() for line in extracted["raw_text"].splitlines() if line.strip()]
        extracted["document_summary"] = " ".join(lines[:5])[:1200]

    populated_numeric = sum(1 for field in FINANCIAL_FIELDS if extracted.get(field) is not None)
    if populated_numeric >= 6:
        extracted["extraction_status"] = "structured"
    elif populated_numeric > 0 or extracted.get("document_summary"):
        extracted["extraction_status"] = "partial"
    else:
        raise ValueError("Unable to extract usable content from PDF document")

    if extracted.get("revenue") is None:
        extracted["extraction_warnings"].append("revenue_not_found")
    return extracted


def _find_column(columns: Iterable[str], keywords: List[str]) -> Optional[str]:
    normalized = {str(column).strip().lower(): column for column in columns}
    for keyword in keywords:
        for lowered, original in normalized.items():
            if keyword in lowered:
                return original
    return None


def _classify_transaction(description: str, credit: float, debit: float) -> str:
    text = (description or "").lower()
    is_bounce = any(marker in text for marker in BOUNCE_MARKERS)
    is_emi = any(marker in text for marker in EMI_MARKERS)
    if is_bounce and is_emi:
        return "emi_bounce"
    if is_bounce:
        return "bounce"
    if is_emi and debit > 0:
        return "loan_repayment"
    if any(token in text for token in ["salary", "payroll"]):
        return "salary_credit"
    if any(token in text for token in ["gst", "tax", "tds"]):
        return "tax_payment"
    if any(token in text for token in ["upi", "neft", "rtgs", "imps"]):
        return "transfer"
    if any(token in text for token in ["cash dep", "cash deposit"]):
        return "cash_deposit"
    if any(token in text for token in ["cash wd", "atm", "cash withdrawal"]):
        return "cash_withdrawal"
    return "other_credit" if credit > 0 else "other_debit"


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
    df = df.copy()
    df.columns = [str(column).strip() for column in df.columns]

    date_col = _find_column(df.columns, ["date", "txn date", "transaction date", "value date"])
    desc_col = _find_column(df.columns, ["description", "narration", "remarks", "particular", "details"])
    credit_col = _find_column(df.columns, ["credit", "deposit", "cr amount", "withdrawal amt."])
    debit_col = _find_column(df.columns, ["debit", "withdrawal", "dr amount"])
    amount_col = _find_column(df.columns, ["amount", "transaction amount"])
    balance_col = _find_column(df.columns, ["balance", "closing bal", "available balance"])

    if not any([credit_col, debit_col, amount_col]):
        raise ValueError("Bank statement CSV does not contain amount columns")

    working = pd.DataFrame()
    working["txn_date"] = pd.to_datetime(df[date_col], errors="coerce", dayfirst=True) if date_col else pd.NaT
    working["description"] = df[desc_col].fillna("") if desc_col else ""
    working["credit"] = df[credit_col].apply(_safe_float) if credit_col else 0.0
    working["debit"] = df[debit_col].apply(_safe_float) if debit_col else 0.0
    working["amount"] = df[amount_col].apply(_safe_float) if amount_col else 0.0
    working["balance"] = df[balance_col].apply(_safe_float) if balance_col else np.nan

    if amount_col and not credit_col and not debit_col:
        working["credit"] = working["amount"].apply(lambda value: value if value > 0 else 0.0)
        working["debit"] = working["amount"].apply(lambda value: abs(value) if value < 0 else 0.0)
    elif amount_col:
        unresolved = (working["credit"] == 0) & (working["debit"] == 0)
        working.loc[unresolved, "credit"] = working.loc[unresolved, "amount"].apply(lambda value: value if value > 0 else 0.0)
        working.loc[unresolved, "debit"] = working.loc[unresolved, "amount"].apply(lambda value: abs(value) if value < 0 else 0.0)

    if working["txn_date"].notna().any():
        working = working.sort_values(["txn_date"]).reset_index(drop=True)
    working["category"] = working.apply(
        lambda row: _classify_transaction(row["description"], row["credit"], row["debit"]),
        axis=1,
    )

    total_inflows = float(working["credit"].sum())
    total_outflows = float(working["debit"].sum())
    net_cash_flow = total_inflows - total_outflows

    monthly = pd.DataFrame()
    if working["txn_date"].notna().any():
        monthly = (
            working.dropna(subset=["txn_date"])
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

    balance_points = working.dropna(subset=["txn_date", "balance"]).groupby("txn_date")["balance"].last().sort_index()
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
    for category, rows in working.groupby("category"):
        category_summary[category] = {
            "count": int(len(rows)),
            "credits": round(float(rows["credit"].sum()), 2),
            "debits": round(float(rows["debit"].sum()), 2),
        }

    bounce_count = int((working["category"] == "bounce").sum() + (working["category"] == "emi_bounce").sum())
    emi_bounce_count = int((working["category"] == "emi_bounce").sum())

    return {
        "total_inflows": round(total_inflows, 2),
        "total_outflows": round(total_outflows, 2),
        "total_credits": round(total_inflows, 2),
        "total_debits": round(total_outflows, 2),
        "net_cash_flow": round(net_cash_flow, 2),
        "num_transactions": int(len(working)),
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


def parse_bureau_json(data: Dict[str, Any]) -> Dict[str, Any]:
    """Parse bureau data and extract delinquency trajectories for commercial underwriting."""
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
    bureau_score = _safe_int(data.get("score") or data.get("bureau_score") or data.get("cibil_score") or 700)
    rbi_defaulter_flag = _recursive_flag_search(data, ["rbi defaulter", "rbi_defaulter", "defaulter list"])
    wilful_defaulter_flag = _recursive_flag_search(data, ["wilful defaulter", "willful defaulter", "wilful_defaulter"])

    return {
        "bureau_score": bureau_score,
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


def compute_financial_ratios(
    financials: Dict[str, Any],
    bank_data: Dict[str, Any],
    bureau_data: Dict[str, Any],
    collateral_value: float,
    loan_amount: float,
    prev_year_revenue: Optional[float] = None,
) -> Dict[str, Any]:
    """Compute all financial ratios needed for underwriting and ML models."""
    revenue = _safe_float(financials.get("revenue") or financials.get("operating_income"), 0.0)
    net_income = _safe_float(financials.get("net_income") or financials.get("net_profit"), 0.0)
    total_assets = _safe_float(financials.get("total_assets"), _safe_float(financials.get("current_assets"), 0.0) + _safe_float(financials.get("fixed_assets"), 0.0) + _safe_float(financials.get("intangible_assets"), 0.0))
    total_liabilities = _safe_float(financials.get("total_liabilities"), _safe_float(financials.get("short_term_liab"), 0.0) + _safe_float(financials.get("long_term_liab"), 0.0) + _safe_float(financials.get("contingent_liab"), 0.0))
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

    annual_debt_service = interest_expense + (total_debt * 0.10)
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

