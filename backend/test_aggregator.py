import asyncio
import os
import httpx
from services.external_aggregator import ExternalDataAggregator

async def test_aggregator():
    os.environ["SIGNZY_API_KEY"] = "mock_signzy_key"
    os.environ["KARZA_API_KEY"] = "mock_karza_key"
    os.environ["CIBIL_API_KEY"] = "mock_cibil_key"
    
    aggregator = ExternalDataAggregator()
    # Mocking httpx to avoid hitting real APIs without keys/costs
    class MockClient:
        def __init__(self, *args, **kwargs):
            self.timeout = kwargs.get("timeout")
        async def __aenter__(self):
            return self
        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass
        async def post(self, url, *args, **kwargs):
            class MockResponse:
                def raise_for_status(self):
                    pass
                def json(self):
                    if "verify-gstin" in url:
                        return {"result": {"status": "ACTIVE", "estimated_revenue": 15000000, "filing_status": "Regular"}}
                    elif "mca-company-details" in url:
                        return {"result": {"directors": ["Dir A", "Dir B"], "authorized_capital": 500000, "paid_up_capital": 100000}}
                    elif "litigation-check" in url:
                        return {"result": {"summary": {"total_cases": 2, "criminal_proceedings": 0}}}
                    elif "bureau-report" in url:
                        return {"report": {"cibil_cmr": 3, "summary": {"vintage_months": 72, "active_lines": 4, "enquiries_last_3m": 1, "highest_dpd_12m": 0}}}
                    return {}
            return MockResponse()

    # Apply monkey patch for the test
    original_client = httpx.AsyncClient
    httpx.AsyncClient = MockClient

    try:
        fact = await aggregator.aggregate_borrower_facts(
            company_name="Test Corp",
            company_id="TC123",
            gstin="27ABCDE1234F1Z5",
            cin="U74999MH2023PTC123456",
            pan="ABCDE1234F"
        )
        print("Aggregation Result:")
        import json
        print(json.dumps(fact, indent=2))
        assert fact["gstin_active"] == True
        assert fact["mca_active_directors"] == 2
        assert fact["litigation_count"] == 2
        assert fact["cibil_commercial_score"] == 3
        print("--- Test Passed ---")
    finally:
        # Restore mock
        httpx.AsyncClient = original_client

if __name__ == "__main__":
    asyncio.run(test_aggregator())
