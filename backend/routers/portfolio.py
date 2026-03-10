from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from services.search_engine import search_engine_instance
from pydantic import BaseModel

router = APIRouter()

class SearchResult(BaseModel):
    id: str
    company_name: str
    industry: Optional[str]
    composite_score: Optional[float]
    status: str
    revenue: Optional[float]
    created_at: Optional[str]
    match_score: Optional[float]
    match_type: Optional[str]

@router.on_event("startup")
async def initialize_search_engine():
    """Initializes the FAISS and TF-IDF indices on startup."""
    # Note: In a real clustered production environment, you'd trigger this
    # via a dedicated worker or message queue to avoid slowing down API startup.
    # For local/demo, we initialize here.
    db_gen = get_db()
    db = next(db_gen)
    try:
        await search_engine_instance.synchronize_index(db)
    finally:
        db.close()

@router.get("/portfolio/search", response_model=List[SearchResult])
async def search_portfolio(
    q: str = Query("", description="Natural language or keyword search query"),
    status: Optional[str] = Query(None, description="Filter by application status"),
    industry: Optional[str] = Query(None, description="Filter by industry"),
    min_score: Optional[float] = Query(None, description="Filter by minimum composite score"),
    limit: int = Query(20, ge=1, le=100, description="Max results to return")
):
    """
    Executes a Hybrid Search (Semantic + Keyword) across all credit records.
    Supports Reciprocal Rank Fusion and real-time filtering.
    """
    filters = {}
    if status:
        filters['status'] = status
    if industry:
        filters['industry'] = industry
    if min_score is not None:
        filters['min_score'] = min_score

    try:
        results = search_engine_instance.search(query=q, filters=filters, top_k=limit)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
