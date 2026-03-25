from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from async_database import get_async_db
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
    try:
        from async_database import AsyncSessionLocal
        async with AsyncSessionLocal() as db:
            await search_engine_instance.synchronize_index(db)
    except Exception as e:
        print(f"Warning: Search engine initialization failed (DB likely unavailable): {e}")

@router.get("/search", response_model=List[SearchResult])
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
        print(f"WARNING: Portfolio search failed (DB likely unavailable): {e}")
        return []
