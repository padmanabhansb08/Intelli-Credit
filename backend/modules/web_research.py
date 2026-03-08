"""
Web-Scale Secondary Research
Provides async crawler functions for e-Courts, MCA, news sentiment, and qualitative insight scoring.
"""
import os
import re
from typing import Any, Dict, List, Optional
from urllib.parse import quote_plus

import asyncio

import httpx
from bs4 import BeautifulSoup

INDUSTRY_MACRO = {
    "Manufacturing": {"growth_rate": 0.04, "volatility": 0.15, "default_rate_sector": 0.035, "outlook": "Stable", "risk_factor": 0.4},
    "IT Services": {"growth_rate": 0.12, "volatility": 0.10, "default_rate_sector": 0.02, "outlook": "Growth", "risk_factor": 0.2},
    "Retail": {"growth_rate": 0.03, "volatility": 0.18, "default_rate_sector": 0.04, "outlook": "Stable", "risk_factor": 0.5},
}

ECOURTS_PROXY_URL = os.environ.get("ECOURTS_PROXY_URL")
MCA_PROXY_URL = os.environ.get("MCA_PROXY_URL")
HUGGINGFACE_API_TOKEN = os.environ.get("HUGGINGFACE_API_TOKEN")
FINBERT_MODEL = os.environ.get("FINBERT_MODEL", "ProsusAI/finbert")

_FINBERT_PIPELINE = None
_FINBERT_LOAD_ATTEMPTED = False


def _label_to_score(label: str, score: float) -> float:
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


def _get_finbert_pipeline():
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


def _lexical_finance_score(text: str) -> float:
    lower_text = (text or "").lower()
    positive_words = ["growth", "healthy", "improving", "profitable", "order book", "stable", "strong"]
    negative_words = ["default", "insolvency", "litigation", "decline", "delay", "overdue", "stress", "weak"]
    pos_count = sum(lower_text.count(word) for word in positive_words)
    neg_count = sum(lower_text.count(word) for word in negative_words)
    total = pos_count + neg_count
    return 0.0 if total == 0 else (pos_count - neg_count) / total


async def _score_texts_finbert(texts: List[str]) -> List[float]:
    texts = [text.strip() for text in texts if text and text.strip()]
    if not texts:
        return []

    pipeline = _get_finbert_pipeline()
    if pipeline is not None:
        try:
            predictions = pipeline(texts[:8], truncation=True)
            return [_label_to_score(prediction.get("label"), prediction.get("score", 0.0)) for prediction in predictions]
        except Exception:
            pass

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
                except Exception:
                    scores.append(_lexical_finance_score(text))
        return scores

    return [_lexical_finance_score(text) for text in texts[:8]]


async def _search_html(client: httpx.AsyncClient, query: str) -> List[Dict[str, str]]:
    url = f"https://duckduckgo.com/html/?q={quote_plus(query)}"
    response = await client.get(url, headers={"User-Agent": "Mozilla/5.0 Intelli-Credit/1.0"})
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    results: List[Dict[str, str]] = []
    for anchor in soup.select("a.result__a")[:6]:
        container = anchor.find_parent("div", class_="result")
        snippet_node = container.select_one("a.result__snippet") if container else None
        results.append(
            {
                "title": anchor.get_text(" ", strip=True),
                "url": anchor.get("href", ""),
                "snippet": snippet_node.get_text(" ", strip=True) if snippet_node else "",
            }
        )
    return results


async def _fetch_proxy_payload(client: httpx.AsyncClient, proxy_url: Optional[str], company_name: str) -> Optional[Any]:
    if not proxy_url:
        return None
    response = await client.get(proxy_url, params={"query": company_name}, headers={"User-Agent": "Mozilla/5.0 Intelli-Credit/1.0"})
    response.raise_for_status()
    content_type = response.headers.get("content-type", "")
    if "json" in content_type:
        return response.json()
    return response.text


async def fetch_news_sentiment(company_name: str) -> Dict[str, Any]:
    """Fetch recent news headlines and score them using FinBERT sentiment."""
    headlines: List[Dict[str, str]] = []
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        try:
            rss_url = f"https://news.google.com/rss/search?q={quote_plus(company_name)}"
            response = await client.get(rss_url, headers={"User-Agent": "Mozilla/5.0 Intelli-Credit/1.0"})
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "xml")
            for item in soup.find_all("item")[:5]:
                headlines.append(
                    {
                        "headline": item.title.get_text(strip=True) if item.title else "",
                        "source": item.source.get_text(strip=True) if item.source else "Google News",
                        "url": item.link.get_text(strip=True) if item.link else "",
                    }
                )
        except Exception:
            try:
                search_results = await _search_html(client, f'"{company_name}" business news')
                headlines = [
                    {"headline": item["title"], "source": "Web Search", "url": item["url"]}
                    for item in search_results[:5]
                ]
            except Exception:
                headlines = [{"headline": f"No reachable external news feed for {company_name}.", "source": "Unavailable", "url": ""}]

    scores = await _score_texts_finbert([item["headline"] for item in headlines])
    avg_score = round(sum(scores) / len(scores), 4) if scores else 0.0
    for index, item in enumerate(headlines):
        item["sentiment"] = _score_to_category(scores[index]) if index < len(scores) else "neutral"
    return {
        "sentiment_score": avg_score,
        "sentiment_category": _score_to_category(avg_score),
        "news_headlines": headlines,
    }

async def fetch_ecourts_disputes(company_name: str) -> Dict[str, Any]:
    """Check e-Courts registries or proxy feeds for ongoing disputes."""
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        try:
            payload = await _fetch_proxy_payload(client, ECOURTS_PROXY_URL, company_name)
            if isinstance(payload, dict):
                cases = payload.get("cases", [])
                return {
                    "litigation_flag": bool(cases),
                    "cases": cases,
                    "source_status": "proxy",
                    "query": company_name,
                }
        except Exception:
            pass

        try:
            results = await _search_html(client, f'site:ecourts.gov.in "{company_name}"')
            cases = [
                {
                    "title": item["title"],
                    "snippet": item["snippet"],
                    "url": item["url"],
                }
                for item in results
                if "ecourts" in item["url"].lower() or "court" in item["title"].lower()
            ]
            return {
                "litigation_flag": bool(cases),
                "cases": cases,
                "source_status": "public_search",
                "query": company_name,
            }
        except Exception as exc:
            return {
                "litigation_flag": False,
                "cases": [],
                "source_status": f"unavailable: {exc}",
                "query": company_name,
            }


async def fetch_mca_filings(company_name: str) -> Dict[str, Any]:
    """Fetch MCA-linked compliance and director signal data via proxy or search scraping."""
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        filings: List[Dict[str, str]] = []
        source_status = "public_search"
        try:
            payload = await _fetch_proxy_payload(client, MCA_PROXY_URL, company_name)
            if isinstance(payload, dict):
                filings = payload.get("filings", [])
                source_status = "proxy"
        except Exception:
            filings = []

        if not filings:
            try:
                results = await _search_html(client, f'site:mca.gov.in "{company_name}" filings OR director OR annual return')
                filings = [
                    {"title": item["title"], "url": item["url"], "snippet": item["snippet"]}
                    for item in results
                    if "mca" in item["url"].lower() or "ministry of corporate affairs" in item["title"].lower()
                ]
            except Exception as exc:
                return {
                    "management_quality": "Average",
                    "regulatory_risk": "Medium",
                    "filings": [],
                    "director_events": [],
                    "source_status": f"unavailable: {exc}",
                }

    joined = " ".join(
        f"{item.get('title', '')} {item.get('snippet', '')}" for item in filings
    ).lower()
    negative_hits = sum(joined.count(term) for term in ["strike off", "insolvency", "disqualified", "show cause", "default"])
    delay_hits = sum(joined.count(term) for term in ["delay", "non filing", "late filing", "adjudication"])
    positive_hits = sum(joined.count(term) for term in ["annual return", "financial statement", "compliance", "appointment"])

    if negative_hits > 0:
        regulatory_risk = "High"
        management_quality = "Weak"
    elif delay_hits > 0:
        regulatory_risk = "Medium"
        management_quality = "Average"
    else:
        regulatory_risk = "Low"
        management_quality = "Strong" if positive_hits > 0 else "Average"

    director_events = [item for item in filings if re.search(r"director|signatory|appointment|resignation", item.get("title", ""), re.IGNORECASE)]
    return {
        "management_quality": management_quality,
        "regulatory_risk": regulatory_risk,
        "filings": filings,
        "director_events": director_events,
        "source_status": source_status,
    }


async def analyze_primary_insights(site_visit: str = None, management_notes: str = None) -> Dict[str, Any]:
    """Use FinBERT sentiment analysis on officer observations and management notes."""
    combined_text = f"{site_visit or ''} {management_notes or ''}".strip()
    if not combined_text:
        return {"sentiment": 0.0, "sentiment_category": "neutral", "impact_bps": 0, "flags": [], "raw_text": ""}

    scores = await _score_texts_finbert([combined_text])
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


async def simulate_web_research(
    company_name: str,
    industry: str,
    revenue: float = 0,
    bureau_score: int = 700,
    site_visit_insights: str = None,
    management_interview_notes: str = None,
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
        "industry_outlook": macro["outlook"],
        "industry_growth_rate": macro["growth_rate"],
        "industry_volatility": macro["volatility"],
        "sector_default_rate": macro["default_rate_sector"],
        "regulatory_risk": mca_data.get("regulatory_risk", "Medium"),
        "management_quality": mca_data.get("management_quality", "Average"),
        "mca_filings": mca_data.get("filings", []),
        "news_headlines": news_data.get("news_headlines", []),
        "web_risk_score": web_risk_score,
        "industry_macro": macro,
        "primary_insights": primary_insights_analysis,
        "related_party_connections": [item.get("title") for item in mca_data.get("director_events", [])],
    }




