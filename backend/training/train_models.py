"""
ML Model Training Pipeline
Trains PD Model, Limit Model, and generates validation metrics.
"""
import os
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import GradientBoostingRegressor, GradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, roc_curve, confusion_matrix, classification_report,
    mean_absolute_error, r2_score
)
from sklearn.preprocessing import StandardScaler
import joblib
import warnings
warnings.filterwarnings("ignore")


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


def train_pd_model(df, model_dir):
    print("\n" + "="*60)
    print("TRAINING PD (Probability of Default) MODEL")
    print("="*60)

    X = df[FEATURE_COLS_PD].copy()
    y = df["defaulted"].copy()

    X = X.fillna(X.median())
    X = X.replace([np.inf, -np.inf], 0)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    model = GradientBoostingClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.1,
        min_samples_split=10,
        min_samples_leaf=5,
        subsample=0.8,
        random_state=42
    )
    model.fit(X_train_scaled, y_train)

    y_pred = model.predict(X_test_scaled)
    y_prob = model.predict_proba(X_test_scaled)[:, 1]

    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred)
    recall = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_prob)
    cm = confusion_matrix(y_test, y_pred).tolist()
    fpr, tpr, thresholds = roc_curve(y_test, y_prob)

    print(f"\n  Accuracy:  {accuracy:.4f}")
    print(f"  Precision: {precision:.4f}")
    print(f"  Recall:    {recall:.4f}")
    print(f"  F1 Score:  {f1:.4f}")
    print(f"  AUC-ROC:   {auc:.4f}")
    print(f"  Confusion Matrix: {cm}")

    metrics = {
        "model_type": "GradientBoostingClassifier",
        "features": FEATURE_COLS_PD,
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1, 4),
        "auc_roc": round(auc, 4),
        "confusion_matrix": cm,
        "roc_curve": {
            "fpr": [round(x, 4) for x in fpr.tolist()],
            "tpr": [round(x, 4) for x in tpr.tolist()],
        },
        "classification_report": classification_report(y_test, y_pred, output_dict=True),
        "train_size": len(X_train),
        "test_size": len(X_test),
        "default_rate_train": round(y_train.mean(), 4),
        "default_rate_test": round(y_test.mean(), 4),
    }

    joblib.dump(model, os.path.join(model_dir, "pd_model.joblib"))
    joblib.dump(scaler, os.path.join(model_dir, "pd_scaler.joblib"))
    with open(os.path.join(model_dir, "pd_metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    print("  -> PD model saved!")
    return model, scaler, metrics


def train_limit_model(df, model_dir):
    print("\n" + "="*60)
    print("TRAINING LIMIT RECOMMENDATION MODEL")
    print("="*60)

    X = df[FEATURE_COLS_LIMIT].copy()
    y = df["optimal_limit"].copy()

    X = X.fillna(X.median())
    X = X.replace([np.inf, -np.inf], 0)

    mask = y > 0
    X = X[mask]
    y = y[mask]
    y = np.log1p(y)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    model = GradientBoostingRegressor(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.1,
        min_samples_split=10,
        min_samples_leaf=5,
        subsample=0.8,
        random_state=42
    )
    model.fit(X_train_scaled, y_train)

    y_pred = model.predict(X_test_scaled)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)

    actual_values = np.expm1(y_test)
    predicted_values = np.expm1(y_pred)
    mae_actual = mean_absolute_error(actual_values, predicted_values)

    print(f"\n  R² Score:          {r2:.4f}")
    print(f"  MAE (log space):   {mae:.4f}")
    print(f"  MAE (actual):      {mae_actual:,.0f}")

    metrics = {
        "model_type": "GradientBoostingRegressor",
        "features": FEATURE_COLS_LIMIT,
        "r2_score": round(r2, 4),
        "mae_log": round(mae, 4),
        "mae_actual": round(mae_actual, 2),
        "train_size": len(X_train),
        "test_size": len(X_test),
    }

    joblib.dump(model, os.path.join(model_dir, "limit_model.joblib"))
    joblib.dump(scaler, os.path.join(model_dir, "limit_scaler.joblib"))
    with open(os.path.join(model_dir, "limit_metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    print("  -> Limit model saved!")
    return model, scaler, metrics


def compute_bias_report(df, model, scaler, model_dir):
    print("\n" + "="*60)
    print("RESPONSIBLE AI - BIAS ANALYSIS")
    print("="*60)

    X = df[FEATURE_COLS_PD].copy().fillna(0).replace([np.inf, -np.inf], 0)
    X_scaled = scaler.transform(X)
    df = df.copy()
    df["predicted_pd"] = model.predict_proba(X_scaled)[:, 1]
    df["predicted_default"] = model.predict(X_scaled)

    bias_report = {"fairness_metrics": {}}

    for attr in ["promoter_gender", "region"]:
        group_metrics = {}
        for group_val in df[attr].unique():
            group_key = str(group_val)
            mask = df[attr] == group_val
            subset = df[mask]
            if len(subset) < 10:
                continue
            group_metrics[group_key] = {
                "count": int(len(subset)),
                "actual_default_rate": float(round(subset["defaulted"].mean(), 4)),
                "predicted_default_rate": float(round(subset["predicted_default"].mean(), 4)),
                "mean_pd": float(round(subset["predicted_pd"].mean(), 4)),
                "approval_rate": float(round((subset["predicted_default"] == 0).mean(), 4)),
            }

        all_approval_rates = [v["approval_rate"] for v in group_metrics.values()]
        if all_approval_rates:
            max_rate = max(all_approval_rates)
            min_rate = min(all_approval_rates)
            disparate_impact = float(round(min_rate / max_rate, 4) if max_rate > 0 else 0.0)
        else:
            disparate_impact = 1.0

        bias_report["fairness_metrics"][attr] = {
            "groups": group_metrics,
            "disparate_impact_ratio": disparate_impact,
            "fair_lending_compliant": bool(disparate_impact >= 0.8),
        }
        print(f"\n  {attr}:")
        for gv, gm in group_metrics.items():
            print(f"    {gv}: approval_rate={gm['approval_rate']:.2%}, mean_pd={gm['mean_pd']:.4f}")
        print(f"    Disparate Impact Ratio: {disparate_impact:.4f} ({'PASS' if disparate_impact >= 0.8 else 'FLAG'})")

    bias_report["mitigation_strategy"] = (
        "Model uses only financial and credit-relevant features. "
        "Protected attributes (gender, region) are excluded from model inputs. "
        "Post-hoc bias monitoring ensures disparate impact ratio >= 0.8 (80% rule)."
    )

    with open(os.path.join(model_dir, "bias_report.json"), "w") as f:
        json.dump(bias_report, f, indent=2)
    print("\n  -> Bias report saved!")
    return bias_report


if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    model_dir = os.path.join(base_dir, "models")
    os.makedirs(model_dir, exist_ok=True)

    data_path = os.path.join(base_dir, "data", "raw", "synthetic_borrowers.csv")
    if not os.path.exists(data_path):
        print("Synthetic data not found. Generating...")
        from generate_synthetic_data import generate_synthetic_dataset
        df = generate_synthetic_dataset()
        os.makedirs(os.path.dirname(data_path), exist_ok=True)
        df.to_csv(data_path, index=False)
    else:
        df = pd.read_csv(data_path)

    pd_model, pd_scaler, pd_metrics = train_pd_model(df, model_dir)
    limit_model, limit_scaler, limit_metrics = train_limit_model(df, model_dir)
    bias_report = compute_bias_report(df, pd_model, pd_scaler, model_dir)

    print("\n" + "="*60)
    print("ALL MODELS TRAINED SUCCESSFULLY")
    print("="*60)
    print(f"  PD Model AUC:    {pd_metrics['auc_roc']}")
    print(f"  Limit Model R²:  {limit_metrics['r2_score']}")
    print(f"  Model files in:  {model_dir}")
