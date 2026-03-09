import asyncio
import os
import httpx
import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ------------------------------------------------------------------
# Structured unified Output Model
# ------------------------------------------------------------------

class BorrowerFact(BaseModel):
    """
    Highly structured, unified JSON object standardizing disparate 
    fintech API responses into a single credit schema for the rules engine.
    """
    company_name: str = ""
    company_id: str = ""
    
    # Signzy (GSTIN)
    gstin_active: bool = False
    gstin_annual_revenue_estimate: float = 0.0
    gstin_filing_status: str = "Unknown"
    
    # Signzy (MCA/CIN)
    mca_active_directors: int = 0
    mca_authorized_capital: float = 0.0
    mca_paidup_capital: float = 0.0
    
    # Karza (Litigation & eCourts)
    litigation_flag: bool = False
    litigation_count: int = 0
    serious_fir_count: int = 0
    
    # TransUnion CIBIL Commercial
    cibil_commercial_score: int = -1
    cibil_credit_history_months: int = 0
    cibil_active_facilities: int = 0
    cibil_recent_enquiries_3m: int = 0
    cibil_max_dpd_last_12m: int = 0
    
    # Aggregation Meta
    data_sources_used: List[str] = Field(default_factory=list)
    fetch_success: bool = True
    errors: List[str] = Field(default_factory=list)


# ------------------------------------------------------------------
# Aggregator Service
# ------------------------------------------------------------------

class ExternalDataAggregator:
    """
    Orchestrates real, asynchronous external API calls to verified 
    Indian fintech providers (Signzy, Karza, TransUnion CIBIL).
    """

    def __init__(self):
        # Securely load API keys from environment (e.g. .env)
        self.signzy_api_key = os.environ.get("SIGNZY_API_KEY")
        self.karza_api_key = os.environ.get("KARZA_API_KEY")
        self.cibil_api_key = os.environ.get("CIBIL_API_KEY")

        # Placeholder URLs - update to real provider URLs in production
        self.signzy_base_url = os.environ.get("SIGNZY_BASE_URL", "https://api.signzy.com/v2")
        self.karza_base_url = os.environ.get("KARZA_BASE_URL", "https://api.karza.in/v3")
        self.cibil_base_url = os.environ.get("CIBIL_BASE_URL", "https://api.transunion.com/commercial/v1")
        
        # We use a relatively high timeout for these aggregator calls 
        # as governmental/bureau endpoints can occasionally be slow.
        self.timeout = 15.0

    async def fetch_signzy_gstin(self, gstin: str) -> Dict[str, Any]:
        """Fetch GSTIN revenue and filing verification via Signzy."""
        if not self.signzy_api_key:
            logging.warning("SIGNZY_API_KEY missing. Returning empty GSTIN data.")
            return {}
            
        url = f"{self.signzy_base_url}/verify-gstin"
        headers = {"Authorization": f"Bearer {self.signzy_api_key}"}
        payload = {"gstin": gstin}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                # In a real environment, this actually hits the endpoint
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logging.error(f"Signzy GSTIN fetch failed for {gstin}: {e}")
            return {"error": str(e)}

    async def fetch_signzy_mca(self, cin: str) -> Dict[str, Any]:
        """Fetch MCA/CIN director details & capital metrics via Signzy."""
        if not self.signzy_api_key:
            return {}

        url = f"{self.signzy_base_url}/mca-company-details"
        headers = {"Authorization": f"Bearer {self.signzy_api_key}"}
        payload = {"cin": cin}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logging.error(f"Signzy MCA fetch failed for {cin}: {e}")
            return {"error": str(e)}

    async def fetch_karza_litigation(self, entity_name: str, pan: str = "") -> Dict[str, Any]:
        """Fetch FIR, e-Courts, and pending litigation via Karza."""
        if not self.karza_api_key:
            logging.warning("KARZA_API_KEY missing. Returning empty Litigation data.")
            return {}

        url = f"{self.karza_base_url}/litigation-check"
        headers = {"x-karza-key": self.karza_api_key}
        payload = {"name": entity_name, "pan": pan}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logging.error(f"Karza Litigation fetch failed for {entity_name}: {e}")
            return {"error": str(e)}

    async def fetch_cibil_commercial(self, company_id: str) -> Dict[str, Any]:
        """Fetch TransUnion CIBIL Commercial API for historical credit behavior."""
        if not self.cibil_api_key:
            logging.warning("CIBIL_API_KEY missing. Returning empty Bureau data.")
            return {}

        url = f"{self.cibil_base_url}/bureau-report"
        headers = {"Authorization": f"Bearer {self.cibil_api_key}"}
        payload = {"entityId": company_id}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logging.error(f"CIBIL Bureau fetch failed for {company_id}: {e}")
            return {"error": str(e)}

    async def aggregate_borrower_facts(
        self, 
        company_name: str, 
        company_id: str, 
        gstin: str = "", 
        cin: str = "", 
        pan: str = ""
    ) -> Dict[str, Any]:
        """
        Concurrently awaits all external APIs and normalizes disparate 
        JSON structures into a single `BorrowerFact` mapping.
        """
        fact = BorrowerFact(company_name=company_name, company_id=company_id)
        
        # Fire off requests concurrently
        tasks = [
            self.fetch_signzy_gstin(gstin) if gstin else asyncio.sleep(0),
            self.fetch_signzy_mca(cin) if cin else asyncio.sleep(0),
            self.fetch_karza_litigation(company_name, pan=pan),
            self.fetch_cibil_commercial(company_id)
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Unpack results safely
        raw_gst, raw_mca, raw_karza, raw_cibil = [
            r if not isinstance(r, BaseException) and r is not None else {"error": str(r)}
            for r in results
        ]

        # Normalize Signzy GSTIN Data
        if "error" not in dict(raw_gst):
            if raw_gst: fact.data_sources_used.append("Signzy_GSTIN")
            result = dict(raw_gst).get("result", {})
            fact.gstin_active = str(result.get("status", "")).upper() == "ACTIVE"
            fact.gstin_annual_revenue_estimate = float(result.get("estimated_revenue", 0.0))
            fact.gstin_filing_status = str(result.get("filing_status", "Unknown"))
        else:
            fact.errors.append(f"GSTIN Fetch: {raw_gst.get('error')}")

        # Normalize Signzy MCA Data
        if "error" not in dict(raw_mca):
            if raw_mca: fact.data_sources_used.append("Signzy_MCA")
            result = dict(raw_mca).get("result", {})
            fact.mca_active_directors = len(result.get("directors", []))
            fact.mca_authorized_capital = float(result.get("authorized_capital", 0.0))
            fact.mca_paidup_capital = float(result.get("paid_up_capital", 0.0))
        else:
            fact.errors.append(f"MCA Fetch: {raw_mca.get('error')}")

        # Normalize Karza Litigation
        if "error" not in dict(raw_karza):
            if raw_karza: fact.data_sources_used.append("Karza_Litigation")
            result = dict(raw_karza).get("result", {})
            summary = result.get("summary", {})
            fact.litigation_count = int(summary.get("total_cases", 0))
            fact.serious_fir_count = int(summary.get("criminal_proceedings", 0))
            fact.litigation_flag = fact.litigation_count > 0 or fact.serious_fir_count > 0
        else:
            fact.errors.append(f"Karza Fetch: {raw_karza.get('error')}")

        # Normalize TransUnion CIBIL
        if "error" not in dict(raw_cibil):
            if raw_cibil: fact.data_sources_used.append("TransUnion_CIBIL")
            result = dict(raw_cibil).get("report", {})
            fact.cibil_commercial_score = int(result.get("cibil_cmr", -1)) # typically CMR-1 to CMR-7 or 1-1000
            
            summary = result.get("summary", {})
            fact.cibil_credit_history_months = int(summary.get("vintage_months", 0))
            fact.cibil_active_facilities = int(summary.get("active_lines", 0))
            fact.cibil_recent_enquiries_3m = int(summary.get("enquiries_last_3m", 0))
            fact.cibil_max_dpd_last_12m = int(summary.get("highest_dpd_12m", 0))
        else:
            fact.errors.append(f"CIBIL Fetch: {raw_cibil.get('error')}")

        
        if fact.errors and not fact.data_sources_used:
            fact.fetch_success = False

        return fact.model_dump()
