"""
Synthetic Credit Dataset Generator
Generates realistic borrower data for training ML models.
"""
import numpy as np
import pandas as pd
import os
import json

def generate_synthetic_dataset(n_samples=2000, seed=42):
    np.random.seed(seed)

    industries = [
        "Manufacturing", "IT Services", "Healthcare", "Real Estate",
        "Retail", "Energy", "Agriculture", "Financial Services",
        "Telecom", "Construction", "Pharmaceuticals", "Automotive"
    ]
    industry_risk_map = {
        "Manufacturing": 0.4, "IT Services": 0.2, "Healthcare": 0.25,
        "Real Estate": 0.55, "Retail": 0.5, "Energy": 0.45,
        "Agriculture": 0.6, "Financial Services": 0.3,
        "Telecom": 0.35, "Construction": 0.5,
        "Pharmaceuticals": 0.2, "Automotive": 0.45
    }
    gender_categories = ["Male", "Female", "Non-Binary"]
    region_categories = ["North", "South", "East", "West", "Central"]

    data = {
        "borrower_id": [f"BRW-{i:05d}" for i in range(n_samples)],
        "company_name": [f"Company_{i}" for i in range(n_samples)],
        "industry": np.random.choice(industries, n_samples),
        "years_in_business": np.random.randint(1, 40, n_samples),
        "revenue": np.random.lognormal(mean=17, sigma=1.5, size=n_samples),
        "revenue_growth": np.random.normal(0.08, 0.15, n_samples),
        "ebitda_margin": np.clip(np.random.normal(0.18, 0.12, n_samples), -0.1, 0.6),
        "total_debt": np.random.lognormal(mean=16, sigma=1.5, size=n_samples),
        "total_equity": np.random.lognormal(mean=16.5, sigma=1.2, size=n_samples),
        "cash_flow": np.random.lognormal(mean=15, sigma=1.5, size=n_samples),
        "annual_debt_service": np.random.lognormal(mean=14.5, sigma=1.2, size=n_samples),
        "collateral_value": np.random.lognormal(mean=16, sigma=1.5, size=n_samples),
        "bureau_score": np.clip(np.random.normal(700, 80, n_samples), 300, 900).astype(int),
        "existing_exposure": np.random.lognormal(mean=15, sigma=1.5, size=n_samples),
        "num_past_defaults": np.random.choice([0, 0, 0, 0, 0, 1, 1, 2, 3], n_samples),
        "loan_amount_requested": np.random.lognormal(mean=16, sigma=1, size=n_samples),
        "promoter_gender": np.random.choice(gender_categories, n_samples, p=[0.5, 0.4, 0.1]),
        "region": np.random.choice(region_categories, n_samples),
    }

    df = pd.DataFrame(data)

    df["revenue"] = df["revenue"].round(0)
    df["total_debt"] = df["total_debt"].round(0)
    df["total_equity"] = df["total_equity"].round(0)
    df["cash_flow"] = df["cash_flow"].round(0)
    df["annual_debt_service"] = df["annual_debt_service"].round(0)
    df["collateral_value"] = df["collateral_value"].round(0)
    df["existing_exposure"] = df["existing_exposure"].round(0)
    df["loan_amount_requested"] = df["loan_amount_requested"].round(0)

    df["ebitda"] = df["revenue"] * df["ebitda_margin"]
    df["debt_equity_ratio"] = df["total_debt"] / (df["total_equity"] + 1)
    df["dscr"] = df["cash_flow"] / (df["annual_debt_service"] + 1)
    df["collateral_coverage"] = df["collateral_value"] / (df["loan_amount_requested"] + 1)
    df["industry_risk"] = df["industry"].map(industry_risk_map)

    cf_std = np.random.uniform(0.05, 0.4, n_samples)
    df["cash_flow_stability"] = 1 - cf_std

    # --- Generate default labels (realistic logic) ---
    default_prob = (
        0.05
        + 0.25 * np.clip(df["debt_equity_ratio"] / 5, 0, 1)
        - 0.15 * np.clip((df["bureau_score"] - 300) / 600, 0, 1)
        + 0.10 * df["industry_risk"]
        - 0.10 * np.clip(df["dscr"] / 3, 0, 1)
        + 0.08 * np.clip(df["num_past_defaults"] / 3, 0, 1)
        - 0.05 * np.clip(df["collateral_coverage"] / 2, 0, 1)
        - 0.03 * np.clip(df["revenue_growth"], -0.1, 0.3)
        - 0.05 * np.clip(df["ebitda_margin"], 0, 0.4)
        + 0.02 * np.clip((40 - df["years_in_business"]) / 40, 0, 1)
    )
    default_prob = np.clip(default_prob, 0.01, 0.95)
    df["default_probability_true"] = default_prob
    df["defaulted"] = (np.random.random(n_samples) < default_prob).astype(int)

    # --- Generate optimal limit (target for limit model) ---
    df["optimal_limit"] = (
        df["cash_flow"] * np.clip(df["dscr"], 0.5, 3) * 0.6
        * np.clip(1 - df["industry_risk"], 0.3, 1)
        * np.clip(df["collateral_coverage"], 0.3, 2)
    ).round(0)

    return df


def generate_web_research_data(n_samples=2000, seed=42):
    np.random.seed(seed + 1)

    news_sentiments = np.random.choice(
        ["positive", "negative", "neutral", "mixed"],
        n_samples,
        p=[0.3, 0.2, 0.35, 0.15]
    )
    sentiment_score_map = {
        "positive": lambda: np.random.uniform(0.2, 0.9),
        "negative": lambda: np.random.uniform(-0.9, -0.2),
        "neutral": lambda: np.random.uniform(-0.1, 0.1),
        "mixed": lambda: np.random.uniform(-0.3, 0.3),
    }

    data = []
    for i in range(n_samples):
        sent = news_sentiments[i]
        record = {
            "borrower_id": f"BRW-{i:05d}",
            "litigation_flag": bool(np.random.random() < 0.15),
            "esg_score": int(np.clip(np.random.normal(65, 15), 20, 100)),
            "sentiment_score": round(sentiment_score_map[sent](), 3),
            "news_sentiment": sent,
            "industry_outlook": np.random.choice(
                ["Growth", "Stable", "Cyclical Downturn", "Recession Risk"],
                p=[0.25, 0.35, 0.25, 0.15]
            ),
            "regulatory_risk": np.random.choice(["Low", "Medium", "High"], p=[0.5, 0.35, 0.15]),
            "management_quality": np.random.choice(["Strong", "Average", "Weak"], p=[0.4, 0.45, 0.15]),
        }
        data.append(record)

    return data


def generate_industry_macro_data():
    industries = {
        "Manufacturing": {"growth_rate": 0.04, "volatility": 0.15, "default_rate_sector": 0.035, "outlook": "Stable"},
        "IT Services": {"growth_rate": 0.12, "volatility": 0.10, "default_rate_sector": 0.02, "outlook": "Growth"},
        "Healthcare": {"growth_rate": 0.08, "volatility": 0.08, "default_rate_sector": 0.018, "outlook": "Growth"},
        "Real Estate": {"growth_rate": -0.02, "volatility": 0.25, "default_rate_sector": 0.055, "outlook": "Cyclical Downturn"},
        "Retail": {"growth_rate": 0.03, "volatility": 0.18, "default_rate_sector": 0.04, "outlook": "Stable"},
        "Energy": {"growth_rate": 0.02, "volatility": 0.22, "default_rate_sector": 0.045, "outlook": "Cyclical Downturn"},
        "Agriculture": {"growth_rate": 0.01, "volatility": 0.20, "default_rate_sector": 0.05, "outlook": "Recession Risk"},
        "Financial Services": {"growth_rate": 0.07, "volatility": 0.12, "default_rate_sector": 0.025, "outlook": "Growth"},
        "Telecom": {"growth_rate": 0.05, "volatility": 0.14, "default_rate_sector": 0.03, "outlook": "Stable"},
        "Construction": {"growth_rate": 0.01, "volatility": 0.20, "default_rate_sector": 0.048, "outlook": "Cyclical Downturn"},
        "Pharmaceuticals": {"growth_rate": 0.10, "volatility": 0.09, "default_rate_sector": 0.015, "outlook": "Growth"},
        "Automotive": {"growth_rate": 0.02, "volatility": 0.18, "default_rate_sector": 0.042, "outlook": "Stable"},
    }
    return industries


if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    for d in ["data/raw", "data/curated", "data/features", "models"]:
        os.makedirs(os.path.join(base_dir, d), exist_ok=True)

    print("Generating synthetic borrower dataset...")
    df = generate_synthetic_dataset()
    raw_path = os.path.join(base_dir, "data", "raw", "synthetic_borrowers.csv")
    df.to_csv(raw_path, index=False)
    print(f"  -> Saved {len(df)} records to {raw_path}")

    print("Generating web research data...")
    web_data = generate_web_research_data()
    web_path = os.path.join(base_dir, "data", "raw", "web_research.json")
    with open(web_path, "w") as f:
        json.dump(web_data, f, indent=2)
    print(f"  -> Saved {len(web_data)} records to {web_path}")

    print("Generating industry macro data...")
    macro_data = generate_industry_macro_data()
    macro_path = os.path.join(base_dir, "data", "raw", "industry_macro.json")
    with open(macro_path, "w") as f:
        json.dump(macro_data, f, indent=2)
    print(f"  -> Saved to {macro_path}")

    curated_path = os.path.join(base_dir, "data", "curated", "borrowers_curated.csv")
    df_curated = df[[
        "borrower_id", "company_name", "industry", "years_in_business",
        "revenue", "revenue_growth", "ebitda_margin", "ebitda",
        "total_debt", "total_equity", "debt_equity_ratio",
        "cash_flow", "annual_debt_service", "dscr",
        "collateral_value", "collateral_coverage",
        "bureau_score", "existing_exposure", "num_past_defaults",
        "loan_amount_requested", "cash_flow_stability",
        "industry_risk", "defaulted", "optimal_limit",
        "promoter_gender", "region"
    ]]
    df_curated.to_csv(curated_path, index=False)
    print(f"  -> Curated dataset saved to {curated_path}")

    print("Data generation complete!")
