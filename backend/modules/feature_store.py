"""
Feature Store Module
Manages storage and retrieval of extracted features and full analysis results.
"""
import json
import os
from typing import Dict, Any, Optional
from datetime import datetime


FEATURE_STORE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "features")
ANALYSIS_STORE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "analyses")


def ensure_store():
    os.makedirs(FEATURE_STORE_DIR, exist_ok=True)
    os.makedirs(ANALYSIS_STORE_DIR, exist_ok=True)


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


def save_full_analysis(analysis_id: str, full_result: Dict[str, Any]) -> str:
    """Save full analysis result including decision, web_research, etc."""
    ensure_store()
    record = {
        "analysis_id": analysis_id,
        "timestamp": datetime.utcnow().isoformat(),
        "full_result": full_result,
    }
    path = os.path.join(ANALYSIS_STORE_DIR, f"{analysis_id}.json")
    with open(path, "w") as f:
        json.dump(record, f, indent=2)
    return path


def load_full_analysis(analysis_id: str) -> Optional[Dict[str, Any]]:
    """Load full analysis result from persistent store."""
    path = os.path.join(ANALYSIS_STORE_DIR, f"{analysis_id}.json")
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return None


def list_analyses() -> list:
    """List all stored analyses from both feature and analysis stores."""
    ensure_store()
    analyses = []
    seen_ids = set()
    
    for store_dir in [FEATURE_STORE_DIR, ANALYSIS_STORE_DIR]:
        if os.path.exists(store_dir):
            for f in os.listdir(store_dir):
                if f.endswith(".json"):
                    path = os.path.join(store_dir, f)
                    with open(path, "r") as fh:
                        data = json.load(fh)
                        aid = data.get("analysis_id")
                        if aid and aid not in seen_ids:
                            seen_ids.add(aid)
                            analyses.append({
                                "analysis_id": aid,
                                "timestamp": data.get("timestamp"),
                            })
    return sorted(analyses, key=lambda x: x.get("timestamp", ""), reverse=True)
