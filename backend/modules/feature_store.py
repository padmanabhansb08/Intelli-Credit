"""
Feature Store Module
Manages storage and retrieval of extracted features.
"""
import json
import os
from typing import Dict, Any, Optional
from datetime import datetime


FEATURE_STORE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "features")


def ensure_store():
    os.makedirs(FEATURE_STORE_DIR, exist_ok=True)


def save_features(analysis_id: str, features: Dict[str, Any]) -> str:
    """Save extracted features to the feature store."""
    ensure_store()
    record = {
        "analysis_id": analysis_id,
        "timestamp": datetime.utcnow().isoformat(),
        "features": features,
    }
    path = os.path.join(FEATURE_STORE_DIR, f"{analysis_id}.json")
    with open(path, "w") as f:
        json.dump(record, f, indent=2)
    return path


def load_features(analysis_id: str) -> Optional[Dict[str, Any]]:
    """Load features from the feature store."""
    path = os.path.join(FEATURE_STORE_DIR, f"{analysis_id}.json")
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return None


def list_analyses() -> list:
    """List all stored analyses."""
    ensure_store()
    analyses = []
    for f in os.listdir(FEATURE_STORE_DIR):
        if f.endswith(".json"):
            path = os.path.join(FEATURE_STORE_DIR, f)
            with open(path, "r") as fh:
                data = json.load(fh)
                analyses.append({
                    "analysis_id": data.get("analysis_id"),
                    "timestamp": data.get("timestamp"),
                })
    return sorted(analyses, key=lambda x: x.get("timestamp", ""), reverse=True)
