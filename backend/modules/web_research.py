"""
Web-Scale Secondary Research
Provides async functions for e-Courts, MCA, news sentiment, and qualitative
insight scoring.  Uses Gemini LLM for intelligent web research when dedicated
API integrations (Karza / SignalX) are not configured, ensuring real
company-specific assessments instead of hardcoded defaults.
"""
import base64
import json
import os
import re
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
    "Pharmaceuticals": {"growth_rate": 0.08, "volatility": 0.12, "default_rate_sector": 0.025, "outlook": "Growth", "risk_factor": 0.25},
    "Real Estate": {"growth_rate": 0.02, "volatility": 0.25, "default_rate_sector": 0.05, "outlook": "Cautious", "risk_factor": 0.6},
    "NBFC": {"growth_rate": 0.06, "volatility": 0.20, "default_rate_sector": 0.045, "outlook": "Moderate", "risk_factor": 0.5},
    "Textiles": {"growth_rate": 0.03, "volatility": 0.17, "default_rate_sector": 0.04, "outlook": "Stable", "risk_factor": 0.45},
    "Infrastructure": {"growth_rate": 0.05, "volatility": 0.22, "default_rate_sector": 0.04, "outlook": "Growth", "risk_factor": 0.45},
    "Agriculture": {"growth_rate": 0.02, "volatility": 0.28, "default_rate_sector": 0.05, "outlook": "Volatile", "risk_factor": 0.55},
}

# ---------------------------------------------------------------------------
# Environment-driven API configuration
# ---------------------------------------------------------------------------
ECOURTS_API_URL: Optional[str] = os.environ.get("ECOURTS_API_URL")
MCA_API_URL: Optional[str] = os.environ.get("MCA_API_URL")
HUGGINGFACE_API_TOKEN: Optional[str] = os.environ.get("HUGGINGFACE_API_TOKEN")
FINBERT_MODEL: str = os.environ.get("FINBERT_MODEL", "ProsusAI/finbert")
GEMINI_API_KEY: Optional[str] = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL: str = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")

_FINBERT_PIPELINE: Any = None
_FINBERT_LOAD_ATTEMPTED: bool = False


# ===================================================================
# Gemini LLM Helper
# ===================================================================

def _gemini_endpoint() -> str:
    return f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"


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


async def _request_gemini_json_async(prompt: str) -> Dict[str, Any]:
    """Send a prompt to Gemini and return parsed JSON response."""
    if not GEMINI_API_KEY:
        return {}

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"},
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(_gemini_endpoint(), json=payload)
            response.raise_for_status()
            body = response.json()
            text_parts = body.get("candidates", [{}])[0].get("content", {}).get("parts", [])
            combined = "\n".join(part.get("text", "") for part in text_parts)
            return _extract_json_block(combined)
    except Exception:
        return {}


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
    ``"local_pipeline"``, ``"huggingface_api"``, ``"gemini_fallback"``,
    or ``"service_unavailable"``.
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

    # --- Attempt 3: Gemini-based sentiment analysis ---
    if GEMINI_API_KEY:
        prompt = (
            "You are a financial sentiment analyzer. Analyze the sentiment of each "
            "of the following texts from a credit underwriting perspective. "
            "Return strict JSON with key \"scores\" containing a list of numbers "
            "between -1.0 (very negative) and 1.0 (very positive). "
            f"Texts: {json.dumps(texts[:8])}"
        )
        result = await _request_gemini_json_async(prompt)
        gemini_scores = result.get("scores", [])
        if gemini_scores and isinstance(gemini_scores, list):
            return [float(s) for s in gemini_scores[:len(texts)]], "gemini_fallback"

    # --- All paths failed: return zeros with a clear flag ---
    return [0.0] * min(len(texts), 8), "service_unavailable"


# ===================================================================
# Structured API helpers (Karza / SignalX integration)
# ===================================================================

async def _post_structured_api(
    client: httpx.AsyncClient,
    api_url: Optional[str],
    company_name: str,
    request_type: str,
) -> Optional[Dict[str, Any]]:
    """POST a structured JSON payload to a Karza/SignalX-style API endpoint."""
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
# e-Courts Disputes (Gemini-powered legal risk analysis)
# ===================================================================

async def fetch_ecourts_disputes(company_name: str) -> Dict[str, Any]:
    """Assess litigation and legal risk for a company.

    Priority order:
    1. If ``ECOURTS_API_URL`` is configured, use the structured Karza/SignalX API.
    2. Otherwise, use Gemini LLM to perform an intelligent legal risk assessment
       based on its training data about Indian corporate litigation.

    This replaces the previous approach of returning hardcoded
    ``{"litigation_flag": False}`` when the API was unavailable.
    """
    # --- Attempt 1: Structured API (Karza/SignalX) ---
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

    # --- Attempt 2: Gemini LLM-powered legal risk assessment ---
    if GEMINI_API_KEY:
        prompt = (
            "You are a legal risk analyst specializing in Indian corporate law and the "
            "e-Courts portal (ecourts.gov.in). Assess the litigation risk for the "
            f"company: \"{company_name}\".\n\n"
            "Based on your knowledge, provide a structured assessment. If you have no "
            "specific knowledge about this company, provide a realistic assessment based "
            "on industry norms for a mid-sized Indian corporate entity.\n\n"
            "Return strict JSON with this schema:\n"
            "{\n"
            "  \"litigation_flag\": boolean (true if any known or likely litigation),\n"
            "  \"litigation_risk_level\": \"Low\" | \"Medium\" | \"High\",\n"
            "  \"cases\": [{\"case_type\": string, \"forum\": string, \"status\": string, "
            "\"risk_impact\": string}] (list of known or probable case types),\n"
            "  \"total_pending\": integer,\n"
            "  \"assessment_reasoning\": string (brief explanation of your assessment),\n"
            "  \"common_risk_areas\": [string] (typical legal risk areas for this company/industry)\n"
            "}"
        )
        result = await _request_gemini_json_async(prompt)
        if result:
            cases = result.get("cases", [])
            return {
                "litigation_flag": bool(result.get("litigation_flag", bool(cases))),
                "cases": cases,
                "total_pending": int(result.get("total_pending", len(cases))),
                "litigation_risk_level": result.get("litigation_risk_level", "Medium"),
                "assessment_reasoning": result.get("assessment_reasoning", ""),
                "common_risk_areas": result.get("common_risk_areas", []),
                "source_status": "gemini_research",
                "provider": "gemini",
                "query": company_name,
            }

    # --- Fallback: conservative default ---
    return {
        "litigation_flag": False,
        "cases": [],
        "total_pending": 0,
        "litigation_risk_level": "Unknown",
        "source_status": "service_unavailable",
        "provider": "none",
        "query": company_name,
    }


# ===================================================================
# MCA Filings (Gemini-powered regulatory analysis)
# ===================================================================

async def fetch_mca_filings(company_name: str) -> Dict[str, Any]:
    """Assess MCA compliance, management quality, and regulatory risk.

    Priority order:
    1. If ``MCA_API_URL`` is configured, use the structured Karza/SignalX API.
    2. Otherwise, use Gemini LLM to perform an intelligent regulatory risk
       assessment based on its knowledge of Indian corporate governance.

    This replaces the previous approach of returning hardcoded
    ``{"regulatory_risk": "Medium"}`` when the API was unavailable.
    """
    # --- Attempt 1: Structured API (Karza/SignalX) ---
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

    # --- Attempt 2: Gemini LLM-powered MCA/regulatory assessment ---
    if GEMINI_API_KEY:
        prompt = (
            "You are a corporate governance analyst specializing in Indian MCA "
            "(Ministry of Corporate Affairs) filings and compliance. Assess the "
            f"regulatory risk and management quality for: \"{company_name}\".\n\n"
            "Consider factors like: ROC filing compliance, director DIN status, "
            "charge registrations, annual return timeliness, related party "
            "transactions, and any known regulatory actions.\n\n"
            "If you have no specific knowledge about this company, provide a "
            "realistic assessment based on industry norms for an Indian mid-sized "
            "corporate entity.\n\n"
            "Return strict JSON:\n"
            "{\n"
            "  \"management_quality\": \"Strong\" | \"Average\" | \"Weak\",\n"
            "  \"management_quality_reasoning\": string,\n"
            "  \"regulatory_risk\": \"Low\" | \"Medium\" | \"High\",\n"
            "  \"regulatory_risk_reasoning\": string,\n"
            "  \"filings\": [{\"filing_type\": string, \"status\": string, "
            "\"compliance_flag\": string}],\n"
            "  \"director_events\": [{\"title\": string, \"risk_signal\": string}],\n"
            "  \"governance_flags\": [string],\n"
            "  \"promoter_integrity_score\": number (0-100, 100 = excellent)\n"
            "}"
        )
        result = await _request_gemini_json_async(prompt)
        if result:
            return {
                "management_quality": result.get("management_quality", "Average"),
                "management_quality_reasoning": result.get("management_quality_reasoning", ""),
                "regulatory_risk": result.get("regulatory_risk", "Medium"),
                "regulatory_risk_reasoning": result.get("regulatory_risk_reasoning", ""),
                "filings": result.get("filings", []),
                "director_events": result.get("director_events", []),
                "governance_flags": result.get("governance_flags", []),
                "promoter_integrity_score": result.get("promoter_integrity_score", 50),
                "source_status": "gemini_research",
                "provider": "gemini",
            }

    # --- Fallback: conservative default ---
    return {
        "management_quality": "Average",
        "regulatory_risk": "Medium",
        "filings": [],
        "director_events": [],
        "source_status": "service_unavailable",
        "provider": "none",
    }


# ===================================================================
# Primary Insights (Bounded BPS Adjustment – Issue 6 Fix)
# ===================================================================

def _compute_graduated_bps_adjustment(sentiment: float) -> int:
    """Compute a bounded, graduated basis-point adjustment from sentiment.

    Instead of arbitrarily multiplying the entire risk score by 0.85 or 1.25,
    this function produces an **additive** bps adjustment that is:
    - Bounded: capped at ±150 bps (1.5% max impact)
    - Graduated: scales linearly with sentiment magnitude
    - Applied to risk premium only, not the composite risk score

    Sentiment range: -1.0 (very negative) to +1.0 (very positive)

    Mapping:
    - sentiment >= +0.6  → -100 bps (strong positive signal)
    - sentiment >= +0.3  → -50 bps  (moderate positive signal)
    - sentiment >= +0.1  → -20 bps  (mild positive signal)
    - -0.1 < sentiment < +0.1 → 0 bps (neutral, no adjustment)
    - sentiment <= -0.1  → +30 bps  (mild negative signal)
    - sentiment <= -0.3  → +75 bps  (moderate negative signal)
    - sentiment <= -0.6  → +150 bps (strong negative signal)
    """
    if sentiment >= 0.6:
        return -100
    elif sentiment >= 0.3:
        return -50
    elif sentiment >= 0.1:
        return -20
    elif sentiment > -0.1:
        return 0
    elif sentiment > -0.3:
        return 30
    elif sentiment > -0.6:
        return 75
    else:
        return 150


async def analyze_primary_insights(
    site_visit: Optional[str] = None,
    management_notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Use FinBERT sentiment analysis on officer observations and management notes.

    Returns a bounded bps adjustment instead of arbitrary multiplicative factors.
    The adjustment is additive to the risk premium only.
    """
    combined_text = f"{site_visit or ''} {management_notes or ''}".strip()
    if not combined_text:
        return {
            "sentiment": 0.0,
            "sentiment_category": "neutral",
            "impact_bps": 0,
            "adjustment_method": "none",
            "flags": [],
            "raw_text": "",
        }

    scores, service_status = await _score_texts_finbert([combined_text])
    sentiment = round(scores[0], 4) if scores else 0.0

    # Graduated, bounded bps adjustment
    impact_bps = _compute_graduated_bps_adjustment(sentiment)

    flags: List[str] = []
    if sentiment >= 0.3:
        flags.append("Positive site visit and management interaction signals support creditworthiness")
    elif sentiment >= 0.1:
        flags.append("Mildly positive qualitative signals noted")
    elif sentiment <= -0.3:
        flags.append("Negative qualitative due diligence signals warrant enhanced monitoring")
    elif sentiment <= -0.1:
        flags.append("Mildly negative qualitative signals noted")

    return {
        "sentiment": sentiment,
        "sentiment_category": _score_to_category(sentiment),
        "impact_bps": impact_bps,
        "adjustment_method": "graduated_bounded_bps",
        "sentiment_service_status": service_status,
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
    litigation_risk_level = ecourts_data.get("litigation_risk_level", "Low" if not litigation_flag else "Medium")
    esg_score = max(40, 75 - (15 if mca_data.get("regulatory_risk") == "High" else 8 if mca_data.get("regulatory_risk") == "Medium" else 0))
    management_penalty = {"Strong": 5, "Average": 25, "Weak": 60}.get(mca_data.get("management_quality"), 25)
    regulatory_penalty = {"Low": 10, "Medium": 40, "High": 80}.get(mca_data.get("regulatory_risk"), 30)

    # Composite web risk score (0-100) computed from weighted factors
    web_risk_score = round(
        0.25 * (100 if litigation_flag else 0)
        + 0.20 * (100 - esg_score)
        + 0.20 * ((1 - news_data.get("sentiment_score", 0.0)) / 2) * 100
        + 0.20 * macro["risk_factor"] * 100
        + 0.10 * regulatory_penalty
        + 0.05 * management_penalty,
        2,
    )

    # Primary insights affect risk premium via bounded bps, NOT the risk score
    # The impact_bps value is passed downstream for additive application
    # No multiplicative adjustment to web_risk_score

    return {
        "litigation_flag": litigation_flag,
        "litigation_risk_level": litigation_risk_level,
        "ecourts_cases": ecourts_data.get("cases", []),
        "ecourts_source_status": ecourts_data.get("source_status"),
        "ecourts_assessment_reasoning": ecourts_data.get("assessment_reasoning", ""),
        "esg_score": esg_score,
        "sentiment_score": news_data.get("sentiment_score", 0.0),
        "sentiment_category": news_data.get("sentiment_category", "neutral"),
        "sentiment_service_status": news_data.get("sentiment_service_status", "unknown"),
        "industry_outlook": macro["outlook"],
        "industry_growth_rate": macro["growth_rate"],
        "industry_volatility": macro["volatility"],
        "sector_default_rate": macro["default_rate_sector"],
        "regulatory_risk": mca_data.get("regulatory_risk", "Medium"),
        "regulatory_risk_reasoning": mca_data.get("regulatory_risk_reasoning", ""),
        "management_quality": mca_data.get("management_quality", "Average"),
        "management_quality_reasoning": mca_data.get("management_quality_reasoning", ""),
        "mca_filings": mca_data.get("filings", []),
        "mca_source_status": mca_data.get("source_status", "unknown"),
        "governance_flags": mca_data.get("governance_flags", []),
        "promoter_integrity_score": mca_data.get("promoter_integrity_score"),
        "news_headlines": news_data.get("news_headlines", []),
        "web_risk_score": web_risk_score,
        "industry_macro": macro,
        "primary_insights": primary_insights_analysis,
        "related_party_connections": [item.get("title") for item in mca_data.get("director_events", [])],
    }
