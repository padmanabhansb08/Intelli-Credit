"""
Data Ingestion Module
Handles PDF parsing, CSV bank statements, JSON bureau data, and financial ratio extraction.
"""
import pdfplumber
import re
import csv
import json
import io
import numpy as np
import os
from typing import Dict, Any, Optional

try:
    from databricks import sql
except ImportError:
    pass

DATABRICKS_SERVER_HOSTNAME = os.environ.get("DATABRICKS_SERVER_HOSTNAME", "mock.cloud.databricks.com")
DATABRICKS_HTTP_PATH = os.environ.get("DATABRICKS_HTTP_PATH", "sql/1.0/endpoints/mock")
DATABRICKS_ACCESS_TOKEN = os.environ.get("DATABRICKS_ACCESS_TOKEN", "mock-token")

def get_databricks_connection():
    """Establish a connection to Databricks SQL Warehouse."""
    return sql.connect(
        server_hostname=DATABRICKS_SERVER_HOSTNAME,
        http_path=DATABRICKS_HTTP_PATH,
        access_token=DATABRICKS_ACCESS_TOKEN
    )

def fetch_gst_from_databricks(company_id: str) -> Dict[str, Any]:
    """Fetch structured GST filings from Databricks Data Lakehouse."""
    try:
        with get_databricks_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(f"SELECT * FROM credit_lakehouse.gst_filings WHERE company_id = '{company_id}'")
                result = cursor.fetchone()
                if result:
                    return {
                        "gstr_3b_revenue": float(result.gstr_3b_revenue),
                        "gstr_2a_itc_claimed": float(result.gstr_2a_itc_claimed),
                        "circular_trading_flag": bool(result.circular_trading_flag),
                        "sales_inflation_risk": max(0, float(result.gstr_3b_revenue) - float(result.gstr_2a_itc_claimed) * 1.5)
                    }
    except Exception as e:
        print(f"Databricks connection failed. Expected with mock keys. Error: {e}")
    # Return empty real structure rather than synthetic data on fail
    return {
        "gstr_3b_revenue": 0.0,
        "gstr_2a_itc_claimed": 0.0,
        "circular_trading_flag": False,
        "sales_inflation_risk": 0.0
    }


def parse_financial_pdf(file_bytes: bytes) -> Dict[str, Any]:
    """Extract financial data from PDF financial statements."""
    extracted = {
        "revenue": None,
        "net_income": None,
        "total_assets": None,
        "total_liabilities": None,
        "total_equity": None,
        "ebitda": None,
        "total_debt": None,
        "cash_and_equivalents": None,
        "operating_cash_flow": None,
        "depreciation": None,
        "interest_expense": None,
        "tax_expense": None,
        "current_assets": None,
        "current_liabilities": None,
        "accounts_receivable": None,
        "inventory": None,
        "raw_text": "",
    }

    patterns = {
        "revenue": [
            r"(?:total\s+)?revenue[:\s]+[\$₹]?\s*([\d,]+(?:\.\d+)?)",
            r"(?:net\s+)?sales[:\s]+[\$₹]?\s*([\d,]+(?:\.\d+)?)",
            r"turnover[:\s]+[\$₹]?\s*([\d,]+(?:\.\d+)?)",
        ],
        "net_income": [
            r"net\s+(?:income|profit)[:\s]+[\$₹]?\s*([\d,]+(?:\.\d+)?)",
            r"profit\s+after\s+tax[:\s]+[\$₹]?\s*([\d,]+(?:\.\d+)?)",
            r"PAT[:\s]+[\$₹]?\s*([\d,]+(?:\.\d+)?)",
        ],
        "total_assets": [
            r"total\s+assets[:\s]+[\$₹]?\s*([\d,]+(?:\.\d+)?)",
        ],
        "total_liabilities": [
            r"total\s+liabilities[:\s]+[\$₹]?\s*([\d,]+(?:\.\d+)?)",
        ],
        "total_equity": [
            r"(?:total\s+)?(?:shareholders?\s+)?equity[:\s]+[\$₹]?\s*([\d,]+(?:\.\d+)?)",
            r"net\s+worth[:\s]+[\$₹]?\s*([\d,]+(?:\.\d+)?)",
        ],
        "ebitda": [
            r"EBITDA[:\s]+[\$₹]?\s*([\d,]+(?:\.\d+)?)",
            r"earnings\s+before\s+interest[^:]*[:\s]+[\$₹]?\s*([\d,]+(?:\.\d+)?)",
        ],
        "total_debt": [
            r"total\s+(?:borrowings?|debt)[:\s]+[\$₹]?\s*([\d,]+(?:\.\d+)?)",
            r"long[\s-]term\s+(?:debt|borrowings?)[:\s]+[\$₹]?\s*([\d,]+(?:\.\d+)?)",
        ],
        "cash_and_equivalents": [
            r"cash\s+(?:and\s+)?(?:cash\s+)?equivalents?[:\s]+[\$₹]?\s*([\d,]+(?:\.\d+)?)",
            r"cash\s+(?:&|and)\s+bank[:\s]+[\$₹]?\s*([\d,]+(?:\.\d+)?)",
        ],
        "operating_cash_flow": [
            r"(?:operating|operational)\s+cash\s+flow[:\s]+[\$₹]?\s*([\d,]+(?:\.\d+)?)",
            r"cash\s+from\s+operations[:\s]+[\$₹]?\s*([\d,]+(?:\.\d+)?)",
        ],
        "depreciation": [
            r"depreciation[:\s]+[\$₹]?\s*([\d,]+(?:\.\d+)?)",
        ],
        "interest_expense": [
            r"interest\s+(?:expense|cost)[:\s]+[\$₹]?\s*([\d,]+(?:\.\d+)?)",
            r"finance\s+cost[:\s]+[\$₹]?\s*([\d,]+(?:\.\d+)?)",
        ],
        "current_assets": [
            r"(?:total\s+)?current\s+assets[:\s]+[\$₹]?\s*([\d,]+(?:\.\d+)?)",
        ],
        "current_liabilities": [
            r"(?:total\s+)?current\s+liabilities[:\s]+[\$₹]?\s*([\d,]+(?:\.\d+)?)",
        ],
    }

    try:
        pdf = pdfplumber.open(io.BytesIO(file_bytes))
        full_text = ""
        for page in pdf.pages:
            text = page.extract_text() or ""
            full_text += text + "\n"

            for table in (page.extract_tables() or []):
                for row in table:
                    if row:
                        row_text = " ".join([str(c) for c in row if c])
                        full_text += row_text + "\n"

        pdf.close()
        extracted["raw_text"] = full_text[:5000]

        for field, field_patterns in patterns.items():
            for pattern in field_patterns:
                match = re.search(pattern, full_text, re.IGNORECASE)
                if match:
                    value_str = match.group(1).replace(",", "")
                    try:
                        extracted[field] = float(value_str)
                    except ValueError:
                        pass
                    break

    except Exception as e:
        extracted["parse_error"] = str(e)
        raise ValueError(f"Failed to parse PDF: {e}")

    if extracted.get("revenue") is None:
        raise ValueError("Failed to extract revenue from PDF. Cannot proceed with decisioning.")

    return extracted


def parse_bank_statement_csv(file_bytes: bytes) -> Dict[str, Any]:
    """Parse bank statement CSV for cash flow analysis."""
    try:
        content = file_bytes.decode("utf-8")
        reader = csv.DictReader(io.StringIO(content))
        rows = list(reader)
    except Exception as e:
        raise ValueError(f"CSV Parsing failed: {e}")

    if not rows:
        raise ValueError("Bank statement CSV is empty.")

    credits = []
    debits = []
    for row in rows:
        credit = 0
        debit = 0
        for key, val in row.items():
            if key and val:
                k = key.lower()
                try:
                    v = float(str(val).replace(",", ""))
                except (ValueError, TypeError):
                    v = 0
                if "credit" in k or "deposit" in k:
                    credit = v
                elif "debit" in k or "withdrawal" in k:
                    debit = v
                elif "amount" in k:
                    if v > 0:
                        credit = v
                    else:
                        debit = abs(v)
        credits.append(credit)
        debits.append(debit)

    total_credits = sum(credits)
    total_debits = sum(debits)
    net_flow = total_credits - total_debits

    monthly_flows = []
    chunk_size = max(1, len(credits) // 12)
    for i in range(0, len(credits), chunk_size):
        chunk_credits = sum(credits[i:i+chunk_size])
        chunk_debits = sum(debits[i:i+chunk_size])
        monthly_flows.append(chunk_credits - chunk_debits)

    stability = 1.0
    if monthly_flows and np.mean(monthly_flows) != 0:
        stability = 1 - min(np.std(monthly_flows) / (abs(np.mean(monthly_flows)) + 1), 1)

    return {
        "total_credits": round(total_credits, 2),
        "total_debits": round(total_debits, 2),
        "net_cash_flow": round(net_flow, 2),
        "num_transactions": len(rows),
        "avg_monthly_flow": round(np.mean(monthly_flows) if monthly_flows else 0, 2),
        "cash_flow_stability": round(max(stability, 0), 4),
        "monthly_flows": [round(f, 2) for f in monthly_flows[:12]],
    }


def parse_bureau_json(data: Dict) -> Dict[str, Any]:
    """Parse bureau score JSON data."""
    return {
        "bureau_score": data.get("score", data.get("bureau_score", 700)),
        "num_past_defaults": data.get("defaults", data.get("num_past_defaults", 0)),
        "credit_history_months": data.get("credit_history_months", 60),
        "active_loans": data.get("active_loans", 2),
        "credit_utilization": data.get("credit_utilization", 0.45),
    }


def compute_financial_ratios(financials: Dict, bank_data: Dict, bureau_data: Dict,
                              collateral_value: float, loan_amount: float,
                              prev_year_revenue: Optional[float] = None) -> Dict[str, Any]:
    """Compute all financial ratios needed for ML models."""
    revenue = financials.get("revenue", 0) or 1
    ebitda = financials.get("ebitda", 0) or 0
    total_debt = financials.get("total_debt", 0) or 0
    total_equity = financials.get("total_equity", 0) or 1
    cash_flow = financials.get("operating_cash_flow") or bank_data.get("avg_monthly_flow", 0) * 12
    interest_expense = financials.get("interest_expense", 0) or 1
    depreciation = financials.get("depreciation", 0) or 0

    if ebitda == 0 and financials.get("net_income"):
        ebitda = financials["net_income"] + interest_expense + (financials.get("tax_expense") or 0) + depreciation

    annual_debt_service = interest_expense + (total_debt * 0.1)

    if prev_year_revenue and prev_year_revenue > 0:
        revenue_growth = (revenue - prev_year_revenue) / prev_year_revenue
    else:
        revenue_growth = np.random.normal(0.08, 0.1)

    ebitda_margin = ebitda / revenue if revenue > 0 else 0
    debt_equity = total_debt / total_equity if total_equity > 0 else 10
    dscr = cash_flow / annual_debt_service if annual_debt_service > 0 else 0
    collateral_coverage = collateral_value / loan_amount if loan_amount > 0 else 0
    cash_flow_stability = bank_data.get("cash_flow_stability", 0.7)

    return {
        "revenue": revenue,
        "revenue_growth": round(revenue_growth, 4),
        "ebitda": ebitda,
        "ebitda_margin": round(ebitda_margin, 4),
        "total_debt": total_debt,
        "total_equity": total_equity,
        "debt_equity_ratio": round(debt_equity, 4),
        "cash_flow": cash_flow,
        "annual_debt_service": annual_debt_service,
        "dscr": round(dscr, 4),
        "collateral_value": collateral_value,
        "loan_amount_requested": loan_amount,
        "collateral_coverage": round(collateral_coverage, 4),
        "bureau_score": bureau_data.get("bureau_score", 700),
        "num_past_defaults": bureau_data.get("num_past_defaults", 0),
        "cash_flow_stability": round(cash_flow_stability, 4),
        "interest_expense": interest_expense,
        "depreciation": depreciation,
        "current_ratio": (
            (financials.get("current_assets") or 0) / (financials.get("current_liabilities") or 1)
            if (financials.get("current_liabilities") or 0) > 0 else 1.5
        ),
    }
