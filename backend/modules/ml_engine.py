"""
ML Engine Module
Loads trained models and runs inference for PD, Limit, and Risk Premium.
"""
import os
import json
try:
    import numpy as np
except ImportError:
    print("WARNING: numpy not found in ml_engine.py")
    np = None

try:
    import pandas as pd
except ImportError:
    print("WARNING: pandas not found in ml_engine.py")
    pd = None
try:
    import joblib
except ImportError:
    print("WARNING: joblib not found")
    joblib = None

try:
    import xgboost as xgb
except ImportError:
    print("WARNING: xgboost not found")
    xgb = None

try:
    import shap
except ImportError:
    print("WARNING: shap not found")
    shap = None
from typing import Dict, Any, Tuple

MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models")

FEATURE_COLS_PD = [
    "revenue_growth", "ebitda_margin", "debt_equity_ratio", "dscr",
    "collateral_coverage", "bureau_score", "num_past_defaults",
    "industry_risk", "cash_flow_stability", "years_in_business"
]

FEATURE_COLS_LIMIT = [
    "revenue", "ebitda", "cash_flow", "dscr", "debt_equity_ratio",
    "collateral_value", "collateral_coverage", "bureau_score",
    "industry_risk", "cash_flow_stability", "years_in_business"
]

_pd_model = None
_pd_scaler = None
_limit_model = None
_limit_scaler = None
_pd_metrics = None
_limit_metrics = None
_bias_report = None


def load_models():
    """Load all trained models and their metrics."""
    global _pd_model, _pd_scaler, _limit_model, _limit_scaler
    global _pd_metrics, _limit_metrics, _bias_report

    _pd_model = joblib.load(os.path.join(MODEL_DIR, "pd_model.joblib"))
    _pd_scaler = joblib.load(os.path.join(MODEL_DIR, "pd_scaler.joblib"))
    _limit_model = joblib.load(os.path.join(MODEL_DIR, "limit_model.joblib"))
    _limit_scaler = joblib.load(os.path.join(MODEL_DIR, "limit_scaler.joblib"))

    metrics_path = os.path.join(MODEL_DIR, "pd_metrics.json")
    if os.path.exists(metrics_path):
        with open(metrics_path) as f:
            _pd_metrics = json.load(f)

    limit_metrics_path = os.path.join(MODEL_DIR, "limit_metrics.json")
    if os.path.exists(limit_metrics_path):
        with open(limit_metrics_path) as f:
            _limit_metrics = json.load(f)

    bias_path = os.path.join(MODEL_DIR, "bias_report.json")
    if os.path.exists(bias_path):
        with open(bias_path) as f:
            _bias_report = json.load(f)


def get_model_metrics() -> Dict[str, Any]:
    """Return model validation metrics for display."""
    return {
        "pd_model": _pd_metrics or {},
        "limit_model": _limit_metrics or {},
        "bias_report": _bias_report or {},
    }


def explain_prediction(features: Dict[str, Any]) -> Any:
    """Predict Probability of Default."""
    if _pd_model is None:
        load_models()

    feature_values = []


def predict_pd(features: Dict[str, Any]) -> Tuple[float, Any]:
    """Predict Probability of Default."""
    if _pd_model is None:
        load_models()

    feature_values = []
    for col in FEATURE_COLS_PD:
        val = features.get(col, 0)
        if val is None or (isinstance(val, float) and (np.isnan(val) or np.isinf(val))):
            val = 0
        feature_values.append(float(val))

    X = np.array([feature_values])
    X_scaled = _pd_scaler.transform(X)
    pd_score = float(_pd_model.predict_proba(X_scaled)[0, 1])

    return pd_score, X_scaled[0]


def predict_limit(features: Dict[str, Any]) -> float:
    """Predict recommended credit limit."""
    if _limit_model is None:
        load_models()

    feature_values = []
    for col in FEATURE_COLS_LIMIT:
        val = features.get(col, 0)
        if val is None or (isinstance(val, float) and (np.isnan(val) or np.isinf(val))):
            val = 0
        feature_values.append(float(val))

    X = np.array([feature_values])
    X_scaled = _limit_scaler.transform(X)
    log_limit = float(_limit_model.predict(X_scaled)[0])
    limit = np.expm1(log_limit)

    dscr = features.get("dscr", 1)
    cash_flow = features.get("cash_flow", 0)

    if dscr < 1.0:
        limit *= 0.5
    elif dscr < 1.5:
        limit *= 0.75

    max_limit = cash_flow * 5
    limit = min(limit, max_limit) if max_limit > 0 else limit

    return max(round(limit, 0), 0)


def compute_risk_premium(pd_score: float, industry_risk: float,
                          collateral_coverage: float, base_rate: float = 0.08) -> Dict[str, Any]:
    """Compute risk premium (spread) over base rate."""
    pd_premium = pd_score * 0.05
    industry_premium = industry_risk * 0.02
    collateral_discount = max(0, (collateral_coverage - 1) * 0.005)
    spread = pd_premium + industry_premium - collateral_discount
    spread = max(round(spread, 4), 0.005)

    return {
        "base_rate": base_rate,
        "pd_premium": round(pd_premium, 4),
        "industry_premium": round(industry_premium, 4),
        "collateral_discount": round(collateral_discount, 4),
        "spread": spread,
        "total_rate": round(base_rate + spread, 4),
        "total_rate_bps": round((base_rate + spread) * 10000),
    }


def get_shap_explanation(features: Dict[str, Any]) -> Dict[str, Any]:
    """Generate SHAP-based feature importance explanation."""
    if _pd_model is None:
        load_models()

    feature_values = []
    for col in FEATURE_COLS_PD:
        val = features.get(col, 0)
        if val is None or (isinstance(val, float) and (np.isnan(val) or np.isinf(val))):
            val = 0
        feature_values.append(float(val))

    X = np.array([feature_values])
    X_scaled = _pd_scaler.transform(X)

    try:
        import shap
        explainer = shap.TreeExplainer(_pd_model)
        shap_values = explainer.shap_values(X_scaled)
        if isinstance(shap_values, list):
            sv = shap_values[1][0]
        else:
            sv = shap_values[0]

        feature_importance = []
        for i, col in enumerate(FEATURE_COLS_PD):
            feature_importance.append({
                "feature": col,
                "shap_value": round(float(sv[i]), 6),
                "feature_value": round(feature_values[i], 4),
                "impact": "increases_risk" if sv[i] > 0 else "decreases_risk",
            })

        feature_importance.sort(key=lambda x: abs(x["shap_value"]), reverse=True)

        return {
            "feature_importance": feature_importance,
            "top_5_factors": feature_importance[:5],
            "base_value": round(float(explainer.expected_value[1]) if isinstance(explainer.expected_value, (list, np.ndarray)) else float(explainer.expected_value), 6),
        }
    except Exception as e:
        raise ValueError(f"Explicit SHAP explanation failed. Non-black-box property broken. Error: {e}")
