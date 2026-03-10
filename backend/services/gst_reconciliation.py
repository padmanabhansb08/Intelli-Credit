import pandas as pd
import re
from difflib import SequenceMatcher
from typing import Dict, Any

def _normalize_string(val: Any) -> str:
    """Standardizes strings for robust matching: uppercase, stripped, alphanumerics only."""
    if pd.isna(val) or val is None:
        return ""
    text = str(val).upper().strip()
    return re.sub(r'[^A-Z0-9]', '', text)

def _fuzzy_match(s1: str, s2: str, threshold: float = 0.85) -> bool:
    """Basic fuzzy matching using difflib SequenceMatcher."""
    if not s1 or not s2:
        return False
    # Exact match on normalized is fastest and most common
    if s1 == s2:
        return True
    ratio = SequenceMatcher(None, s1, s2).ratio()
    return ratio >= threshold

def reconcile_gst_data(gstr2a_df: pd.DataFrame, gstr3b_df: pd.DataFrame) -> Dict[str, Any]:
    """
    Reconciles GSTR-2A (auto-populated purchases/ITC) against GSTR-3B (declared summary).
    
    Detects if the Total Tax claimed/declared varies by more than 5%,
    and provides a fuzzy-matched reconciliation summary for line items.
    
    Args:
        gstr2a_df (pd.DataFrame): DataFrame containing ['Invoice_Number', 'GSTIN', 'Total_Tax']
        gstr3b_df (pd.DataFrame): DataFrame containing ['Invoice_Number', 'GSTIN', 'Total_Tax']
        
    Returns:
        Dict returning the variance, threshold flag, and reconciliation statistics.
    """
    
    if gstr2a_df.empty or gstr3b_df.empty:
        return {
            "gstr_mismatch_detected": False,
            "variance_pct": 0.0,
            "message": "Insufficient data for reconciliation."
        }
        
    # 1. Total Tax Variance Calculation
    total_tax_2a = pd.to_numeric(gstr2a_df.get('Total_Tax', pd.Series(dtype=float)), errors='coerce').sum()
    total_tax_3b = pd.to_numeric(gstr3b_df.get('Total_Tax', pd.Series(dtype=float)), errors='coerce').sum()
    
    if total_tax_3b == 0 and total_tax_2a > 0:
        variance_pct = 100.0
    elif total_tax_3b == 0 and total_tax_2a == 0:
        variance_pct = 0.0
    else:
        variance_pct = abs((total_tax_2a - total_tax_3b) / total_tax_3b) * 100

    gstr_mismatch_detected = variance_pct > 5.0

    # 2. Setup for Fuzzy Matching
    # In a real environment, GSTR3B is summary-level, but if detailed line items are provided:
    matched_count = 0
    unmatched_2a = []
    
    # Normalize keys for fuzzy match (if column exists)
    has_keys_2a = 'Invoice_Number' in gstr2a_df.columns and 'GSTIN' in gstr2a_df.columns
    has_keys_3b = 'Invoice_Number' in gstr3b_df.columns and 'GSTIN' in gstr3b_df.columns

    if has_keys_2a and has_keys_3b:
        # Pre-normalize 3B keys for slightly faster iteration
        normalized_3b = []
        for _, row_3b in gstr3b_df.iterrows():
            normalized_3b.append({
                'inv': _normalize_string(row_3b.get('Invoice_Number', '')),
                'gstin': _normalize_string(row_3b.get('GSTIN', ''))
            })
            
        for _, row_2a in gstr2a_df.iterrows():
            inv_2a = _normalize_string(row_2a.get('Invoice_Number', ''))
            gstin_2a = _normalize_string(row_2a.get('GSTIN', ''))
            
            match_found = False
            for target in normalized_3b:
                if _fuzzy_match(inv_2a, target['inv']) and _fuzzy_match(gstin_2a, target['gstin']):
                    match_found = True
                    break
                    
            if match_found:
                matched_count += 1
            else:
                unmatched_2a.append({
                    "Invoice_Number": row_2a.get('Invoice_Number'),
                    "GSTIN": row_2a.get('GSTIN')
                })

    return {
        "gstr_mismatch_detected": gstr_mismatch_detected,
        "variance_pct": round(variance_pct, 2),
        "total_tax_2a": total_tax_2a,
        "total_tax_3b": total_tax_3b,
        "line_items_matched": matched_count,
        "unmatched_2a_count": len(unmatched_2a),
        "message": "Mismatch detected exceeding 5% tolerance." if gstr_mismatch_detected else "GST limits within acceptable tolerance."
    }
