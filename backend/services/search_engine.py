import math
import asyncio
from typing import List, Dict, Any, Optional
import numpy as np

try:
    from sentence_transformers import SentenceTransformer
    import faiss
    from sklearn.feature_extraction.text import TfidfVectorizer
except ImportError:
    SentenceTransformer = None
    faiss = None
    TfidfVectorizer = None

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from async_models import CreditRecord


class HybridSearchEngine:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(HybridSearchEngine, cls).__new__(cls)
            cls._instance.initialized = False
        return cls._instance

    def __init__(self):
        if self.initialized:
            return
            
        # 1. Semantic Search Components (Dense Vectors)
        # Using a lightweight, fast sentence transformer model
        if SentenceTransformer:
            self.embedder = SentenceTransformer('all-MiniLM-L6-v2')
            self.embedding_dim = self.embedder.get_sentence_embedding_dimension()
            # FAISS Index for Inner Product (Cosine Similarity if vectors are normalized)
            self.index = faiss.IndexFlatIP(self.embedding_dim)
        
        # 2. Keyword Search Components (Sparse Vectors)
        if TfidfVectorizer:
            self.tfidf = TfidfVectorizer(stop_words='english', lowercase=True)
            self.tfidf_matrix = None
            
        # 3. ID Mapping
        self.record_ids: List[str] = []
        self.record_metadata: Dict[str, dict] = {}
        
        self.initialized = True
        self.is_ready = False

    async def synchronize_index(self, db: AsyncSession):
        """Builds both FAISS and TF-IDF indices from the database."""
        if not SentenceTransformer or not faiss or not TfidfVectorizer:
            print("Warning: Search dependencies missing. Engine won't initialize.")
            return

        records = (await db.execute(select(CreditRecord))).scalars().all()
        if not records:
            self.is_ready = True
            return

        texts = []
        self.record_ids = []
        self.record_metadata = {}

        for rec in records:
            # Construct a rich text representation for embedding
            text_repr = f"{rec.company_name or ''} {rec.industry or ''} {rec.full_text_summary or ''} "
            text_repr += f"{rec.character_summary or ''} {rec.capacity_summary or ''} "
            text_repr += f"{rec.capital_summary or ''} {rec.collateral_summary or ''} {rec.conditions_summary or ''}"
            
            texts.append(text_repr)
            self.record_ids.append(rec.id)
            
            # Cache metadata for fast retrieval
            self.record_metadata[rec.id] = {
                "id": rec.id,
                "company_name": rec.company_name,
                "industry": rec.industry,
                "composite_score": rec.composite_score,
                "status": rec.status,
                "revenue": rec.revenue,
                "created_at": rec.created_at.isoformat() if rec.created_at else None
            }

        # Build Semantic Index
        # Run blocking embedding generation in threadpool
        embeddings = await asyncio.to_thread(self.embedder.encode, texts, convert_to_numpy=True)
        # Normalize vectors for cosine similarity in FAISS
        faiss.normalize_L2(embeddings)
        self.index.reset()
        self.index.add(embeddings)

        # Build Keyword Index
        self.tfidf_matrix = await asyncio.to_thread(self.tfidf.fit_transform, texts)
        
        self.is_ready = True
        print(f"Hybrid Search Engine ready with {len(self.record_ids)} records.")

    def _semantic_search(self, query: str, k: int = 20) -> Dict[str, float]:
        """Returns Dict[record_id, semantic_score]"""
        if not self.is_ready or self.index.ntotal == 0:
            return {}
            
        query_vector = self.embedder.encode([query])
        faiss.normalize_L2(query_vector)
        
        # D is distances/scores, I is indices
        D, I = self.index.search(query_vector, min(k, len(self.record_ids)))
        
        results = {}
        for score, idx in zip(D[0], I[0]):
            if idx != -1:
                rec_id = self.record_ids[idx]
                results[rec_id] = float(score)
        return results

    def _keyword_search(self, query: str, k: int = 20) -> Dict[str, float]:
        """Returns Dict[record_id, keyword_score] using Cosine Similarity on TF-IDF"""
        if not self.is_ready or self.tfidf_matrix is None:
            return {}
            
        query_vec = self.tfidf.transform([query])
        
        # Dot product of normalized vectors = Cosine Similarity
        cosine_similarities = (self.tfidf_matrix * query_vec.T).toarray().flatten()
        
        # Get top K indices
        top_indices = cosine_similarities.argsort()[-k:][::-1]
        
        results = {}
        for idx in top_indices:
            score = cosine_similarities[idx]
            if score > 0: # Only return matches
                rec_id = self.record_ids[idx]
                results[rec_id] = float(score)
        return results

    def search(self, query: str, filters: dict = None, top_k: int = 10) -> List[dict]:
        """Executes Hybrid Search with Reciprocal Rank Fusion and inline filtering."""
        if not self.is_ready or not query.strip() or len(self.record_ids) == 0:
            # Fallback to pure filtering if no query (empty state handling)
            return self._apply_filters(self.record_metadata.values(), filters)[:top_k]

        # 1. Get ranked lists
        semantic_results = self._semantic_search(query, k=top_k * 2)
        keyword_results = self._keyword_search(query, k=top_k * 2)

        # 2. Apply Reciprocal Rank Fusion (RRF)
        rrf_k = 60 # Constant for RRF smoothing
        rrf_scores = {}
        
        # Note: dicts preserve insertion order in Python 3.7+, but let's be explicit
        semantic_ranked = sorted(semantic_results.items(), key=lambda x: x[1], reverse=True)
        for rank, (doc_id, score) in enumerate(semantic_ranked):
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0) + 1.0 / (rrf_k + rank + 1)
            
        keyword_ranked = sorted(keyword_results.items(), key=lambda x: x[1], reverse=True)
        for rank, (doc_id, score) in enumerate(keyword_ranked):
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0) + 1.0 / (rrf_k + rank + 1)

        # 3. Sort by RRF Score
        final_ranked_ids = sorted(rrf_scores.keys(), key=lambda x: rrf_scores[x], reverse=True)

        # 4. Filter and Hydrate Results
        hydrated_results = []
        for doc_id in final_ranked_ids:
            meta = self.record_metadata.get(doc_id)
            if meta and self._passes_filters(meta, filters):
                # Attach match type for UI highlighting
                meta_copy = dict(meta)
                meta_copy['match_score'] = rrf_scores[doc_id]
                
                # Determine primary match reason
                s_score = semantic_results.get(doc_id, 0)
                k_score = keyword_results.get(doc_id, 0)
                if k_score > 0.5 and k_score > s_score:
                    meta_copy['match_type'] = 'Exact Match'
                else:
                    meta_copy['match_type'] = 'Semantic Context'
                    
                hydrated_results.append(meta_copy)
                
            if len(hydrated_results) >= top_k:
                break
                
        return hydrated_results

    def _passes_filters(self, meta: dict, filters: dict) -> bool:
        if not filters:
            return True
        
        if filters.get('status') and meta.get('status') != filters['status']:
            return False
            
        if filters.get('industry') and meta.get('industry') != filters['industry']:
            return False
            
        if filters.get('min_score'):
            score = meta.get('composite_score', 0)
            if score is None or score < float(filters['min_score']):
                return False
                
        return True
        
    def _apply_filters(self, records, filters: dict) -> List[dict]:
        if not filters:
            return list(records)
        return [r for r in records if self._passes_filters(r, filters)]

search_engine_instance = HybridSearchEngine()
