"""
Web-Scale Secondary Research
Provides async functions for e-Courts, MCA, news sentiment, and qualitative
insight scoring.  All external data fetches use structured JSON API
integrations (mock Karza / SignalX providers) instead of brittle HTML scraping.
"""
import os
from typing import Any, Dict, List, Optional, Tuple

import asyncio
import httpx

# ---------------------------------------------------------------------------
# Industry Macroeconomics (static lookup – injectable in future)
# ---------------------------------------------------------------------------
INDUSTRY_MACRO: Dict[str, Dict[str, Any]] = {
    "Manufacturing": {"growth_rate": 0.04, "volatility": 0.15, "default_rate_sector": 0.035, "outlook": "Stable", "risk_factor": 0.4},
    "IT Services": {"growth_rate": 0.12, "volatility": 0.10, "default_rate_sector": 0.02, "outlook": "Growth", "risk_factor": 0.2},
    "Retail": {"growth_rate": 0.03, "volatility": 0.18, "default_rate_sector": 0.04, "outlook": "Stable", "risk_factor": 0.5},
}

# ---------------------------------------------------------------------------
# Environment-driven API configuration
# ---------------------------------------------------------------------------
ECOURTS_API_URL: Optional[str] = os.environ.get("ECOURTS_API_URL")
MCA_API_URL: Optional[str] = os.environ.get("MCA_API_URL")
HUGGINGFACE_API_TOKEN: Optional[str] = os.environ.get("HUGGINGFACE_API_TOKEN")
FINBERT_MODEL: str = os.environ.get("FINBERT_MODEL", "ProsusAI/finbert")

_FINBERT_PIPELINE: Any = None
_FINBERT_LOAD_ATTEMPTED: bool = False


# ===================================================================
# FinBERT Sentiment
# ===================================================================

def _label_to_score(label: str, score: float) -> float:
    """Convert a FinBERT label + confidence into a signed score."""
    label = (label or "").lower()
    if "positive" in label:
        return abs(score)
    if "negative" in label:
        return -abs(score)
    if "neutral" in label:
        return 0.0
    return score if label.startswith("pos") else (-score if label.startswith("neg") else 0.0)


def _score_to_category(score: float) -> str:
    if score >= 0.2:
        return "positive"
    if score <= -0.2:
        return "negative"
    return "neutral"


def _get_finbert_pipeline() -> Any:
    global _FINBERT_PIPELINE, _FINBERT_LOAD_ATTEMPTED
    if _FINBERT_LOAD_ATTEMPTED:
        return _FINBERT_PIPELINE
    _FINBERT_LOAD_ATTEMPTED = True
    try:
        from transformers import pipeline
        _FINBERT_PIPELINE = pipeline("text-classification", model=FINBERT_MODEL, tokenizer=FINBERT_MODEL)
    except Exception:
        _FINBERT_PIPELINE = None
    return _FINBERT_PIPELINE


async def _score_texts_finbert(texts: List[str]) -> Tuple[List[float], str]:
    """Score a list of texts using FinBERT sentiment analysis.

    Returns ``(scores, service_status)`` where *service_status* is one of
    ``"local_pipeline"``, ``"huggingface_api"``, or ``"service_unavailable"``.
    If both the local pipeline **and** the HuggingFace API are unreachable
    every score defaults to ``0.0`` and the status is ``"service_unavailable"``
    – no lexical word-count fallback is used.
    """
    texts = [text.strip() for text in texts if text and text.strip()]
    if not texts:
        return [], "no_input"

    # --- Attempt 1: local transformers pipeline ---
    pipeline = _get_finbert_pipeline()
    if pipeline is not None:
        try:
            predictions = pipeline(texts[:8], truncation=True)
            scores = [
                _label_to_score(p.get("label"), p.get("score", 0.0))
                for p in predictions
            ]
            return scores, "local_pipeline"
        except Exception:
            pass

    # --- Attempt 2: HuggingFace Inference API ---
    if HUGGINGFACE_API_TOKEN:
        headers = {"Authorization": f"Bearer {HUGGINGFACE_API_TOKEN}"}
        scores: List[float] = []
        async with httpx.AsyncClient(timeout=20.0) as client:
            for text in texts[:8]:
                try:
                    response = await client.post(
                        f"https://api-inference.huggingface.co/models/{FINBERT_MODEL}",
                        headers=headers,
                        json={"inputs": text[:2000]},
                    )
                    response.raise_for_status()
                    payload = response.json()
                    candidates = payload[0] if payload and isinstance(payload[0], list) else payload
                    if isinstance(candidates, list):
                        best = max(candidates, key=lambda item: item.get("score", 0.0))
                        scores.append(_label_to_score(best.get("label"), best.get("score", 0.0)))
                    else:
                        scores.append(0.0)
                except Exception:
                    scores.append(0.0)
        if scores:
            return scores, "huggingface_api"

    # --- Both paths failed: return zeros with a clear flag ---
    return [0.0] * min(len(texts), 8), "service_unavailable"


# ===================================================================
# Structured API helpers (mock Karza / SignalX integration)
# ===================================================================

async def _post_structured_api(
    client: httpx.AsyncClient,
    api_url: Optional[str],
    company_name: str,
    request_type: str,
) -> Optional[Dict[str, Any]]:
    """POST a structured JSON payload to a Karza/SignalX-style API endpoint.

    Returns the parsed JSON response or ``None`` if the endpoint is
    unreachable or not configured.
    """
    if not api_url:
        return None
    try:
        response = await client.post(
            api_url,
            json={"company_name": company_name, "request_type": request_type},
            headers={
                "Content-Type": "application/json",
                "User-Agent": "Intelli-Credit/2.0",
            },
        )
        response.raise_for_status()
        return response.json()
    except Exception:
        return None


# ===================================================================
# News Sentiment
# ===================================================================

async def fetch_news_sentiment(company_name: str) -> Dict[str, Any]:
    """Fetch recent news headlines and score them using FinBERT sentiment.

    Uses Google News RSS as the primary source.  If RSS is unreachable the
    function returns an empty headline list – **no DuckDuckGo HTML scraping
    is attempted**.
    """
    headlines: List[Dict[str, str]] = []
    from urllib.parse import quote_plus

    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        try:
            rss_url = f"https://news.google.com/rss/search?q={quote_plus(company_name)}"
            response = await client.get(rss_url, headers={"User-Agent": "Mozilla/5.0 Intelli-Credit/2.0"})
            response.raise_for_status()
            # Lightweight XML parsing without requiring bs4 for RSS
            try:
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(response.text, "xml")
                for item in soup.find_all("item")[:5]:
                    headlines.append({
                        "headline": item.title.get_text(strip=True) if item.title else "",
                        "source": item.source.get_text(strip=True) if item.source else "Google News",
                        "url": item.link.get_text(strip=True) if item.link else "",
                    })
            except Exception:
                headlines = []
        except Exception:
            headlines = []

    if not headlines:
        headlines = [{"headline": f"No reachable external news feed for {company_name}.", "source": "Unavailable", "url": ""}]

    scores, sentiment_service_status = await _score_texts_finbert([h["headline"] for h in headlines])
    avg_score = round(sum(scores) / len(scores), 4) if scores else 0.0
    for idx, item in enumerate(headlines):
        item["sentiment"] = _score_to_category(scores[idx]) if idx < len(scores) else "neutral"

    return {
        "sentiment_score": avg_score,
        "sentiment_category": _score_to_category(avg_score),
        "news_headlines": headlines,
        "sentiment_service_status": sentiment_service_status,
    }


# ===================================================================
# e-Courts Disputes (structured API – mock Karza / SignalX)
# ===================================================================

async def fetch_ecourts_disputes(company_name: str) -> Dict[str, Any]:
    """Check e-Courts registries for ongoing disputes via a structured API.

    Expects the endpoint at ``ECOURTS_API_URL`` to accept a JSON POST with
    ``{"company_name": ..., "request_type": "ecourts_dispute_check"}`` and
    return::

        {"cases": [...], "total_pending": int, "provider": str}

    If the API is not configured or unreachable the function returns a
    safe default with ``"source_status": "service_unavailable"``.
    """
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        payload = await _post_structured_api(
            client, ECOURTS_API_URL, company_name, "ecourts_dispute_check",
        )
        if payload and isinstance(payload, dict):
            cases = payload.get("cases", [])
            return {
                "litigation_flag": bool(cases),
                "cases": cases,
                "total_pending": int(payload.get("total_pending", len(cases))),
                "source_status": "api",
                "provider": payload.get("provider", "karza"),
                "query": company_name,
            }

    return {
        "litigation_flag": False,
        "cases": [],
        "total_pending": 0,
        "source_status": "service_unavailable",
        "provider": "none",
        "query": company_name,
    }


# ===================================================================
# MCA Filings (structured API – mock Karza / SignalX)
# ===================================================================

async def fetch_mca_filings(company_name: str) -> Dict[str, Any]:
    """Fetch MCA-linked compliance and director signal data via structured API.

    Expects the endpoint at ``MCA_API_URL`` to accept a JSON POST with
    ``{"company_name": ..., "request_type": "mca_compliance_check"}`` and
    return::

        {"filings": [...], "director_events": [...],
         "management_quality": str, "regulatory_risk": str,
         "provider": str}

    If the API is not configured or unreachable the function returns
    conservative defaults with ``"source_status": "service_unavailable"``.
    """
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        payload = await _post_structured_api(
            client, MCA_API_URL, company_name, "mca_compliance_check",
        )
        if payload and isinstance(payload, dict):
            return {
                "management_quality": payload.get("management_quality", "Average"),
                "regulatory_risk": payload.get("regulatory_risk", "Medium"),
                "filings": payload.get("filings", []),
                "director_events": payload.get("director_events", []),
                "source_status": "api",
                "provider": payload.get("provider", "karza"),
            }

    return {
        "management_quality": "Average",
        "regulatory_risk": "Medium",
        "filings": [],
        "director_events": [],
        "source_status": "service_unavailable",
        "provider": "none",
    }


# ===================================================================
# Primary Insights (site visit / management notes)
# ===================================================================

async def analyze_primary_insights(
    site_visit: Optional[str] = None,
    management_notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Use FinBERT sentiment analysis on officer observations and management notes."""
    combined_text = f"{site_visit or ''} {management_notes or ''}".strip()
    if not combined_text:
        return {"sentiment": 0.0, "sentiment_category": "neutral", "impact_bps": 0, "flags": [], "raw_text": ""}

    scores, _ = await _score_texts_finbert([combined_text])
    sentiment = round(scores[0], 4) if scores else 0.0
    impact_bps = 0
    flags: List[str] = []
    if sentiment >= 0.25:
        impact_bps = -50
        flags.append("Positive site visit and management interaction signals")
    elif sentiment <= -0.2:
        impact_bps = 100
        flags.append("Negative qualitative due diligence signals")

    return {
        "sentiment": sentiment,
        "sentiment_category": _score_to_category(sentiment),
        "impact_bps": impact_bps,
        "flags": flags,
        "raw_text": combined_text,
    }


# ===================================================================
# Full Research Orchestrator
# ===================================================================

async def simulate_web_research(
    company_name: str,
    industry: str,
    revenue: float = 0,
    bureau_score: int = 700,
    site_visit_insights: Optional[str] = None,
    management_interview_notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Execute the full async secondary research workflow and combine it with primary insights."""
    news_data, ecourts_data, mca_data, primary_insights_analysis = await asyncio.gather(
        fetch_news_sentiment(company_name),
        fetch_ecourts_disputes(company_name),
        fetch_mca_filings(company_name),
        analyze_primary_insights(site_visit_insights, management_interview_notes),
    )

    macro = INDUSTRY_MACRO.get(
        industry,
        {"growth_rate": 0.05, "volatility": 0.15, "default_rate_sector": 0.03, "outlook": "Stable", "risk_factor": 0.3},
    )
    litigation_flag = ecourts_data.get("litigation_flag", False)
    esg_score = max(40, 75 - (15 if mca_data.get("regulatory_risk") == "High" else 8 if mca_data.get("regulatory_risk") == "Medium" else 0))
    management_penalty = {"Strong": 5, "Average": 25, "Weak": 60}.get(mca_data.get("management_quality"), 25)
    regulatory_penalty = {"Low": 10, "Medium": 40, "High": 80}.get(mca_data.get("regulatory_risk"), 30)

    web_risk_score = round(
        0.25 * (100 if litigation_flag else 0)
        + 0.20 * (100 - esg_score)
        + 0.20 * ((1 - news_data.get("sentiment_score", 0.0)) / 2) * 100
        + 0.20 * macro["risk_factor"] * 100
        + 0.10 * regulatory_penalty
        + 0.05 * management_penalty,
        2,
    )

    if primary_insights_analysis["sentiment"] >= 0.25:
        web_risk_score = round(max(0.0, web_risk_score * 0.85), 2)
    elif primary_insights_analysis["sentiment"] <= -0.2:
        web_risk_score = round(min(100.0, web_risk_score * 1.25), 2)

    return {
        "litigation_flag": litigation_flag,
        "ecourts_cases": ecourts_data.get("cases", []),
        "ecourts_source_status": ecourts_data.get("source_status"),
        "esg_score": esg_score,
        "sentiment_score": news_data.get("sentiment_score", 0.0),
        "sentiment_category": news_data.get("sentiment_category", "neutral"),
        "sentiment_service_status": news_data.get("sentiment_service_status", "unknown"),
        "industry_outlook": macro["outlook"],
        "industry_growth_rate": macro["growth_rate"],
        "industry_volatility": macro["volatility"],
        "sector_default_rate": macro["default_rate_sector"],
        "regulatory_risk": mca_data.get("regulatory_risk", "Medium"),
        "management_quality": mca_data.get("management_quality", "Average"),
        "mca_filings": mca_data.get("filings", []),
        "mca_source_status": mca_data.get("source_status", "unknown"),
        "news_headlines": news_data.get("news_headlines", []),
        "web_risk_score": web_risk_score,
        "industry_macro": macro,
        "primary_insights": primary_insights_analysis,
        "related_party_connections": [item.get("title") for item in mca_data.get("director_events", [])],
    }
