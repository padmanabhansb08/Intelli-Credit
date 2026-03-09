import asyncio
import time
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_async_execution():
    payload = {
        "applicant_name": "Acme Corp",
        "pan_number": "ABCDE1234F",
        "loan_amount": 1000000,
        "pdf_urls": ["s3://bucket/financials.pdf"]
    }
    
    print("Initiating Execution Engine Test on DAG `mock_policy`...")
    
    start_time = time.time()
    response = client.post("/api/v1/engine/execute/mock_policy", json=payload)
    end_time = time.time()
    
    duration = end_time - start_time
    print(f"Total Execution Time: {duration:.2f} seconds")
    
    # Validation logic:
    # 1. Trigger Node finishes (~0 sec)
    # 2. Integration1, Integration2, LLM all start concurrently
    #    - Integration1 Sleep = 1s
    #    - Integration2 Sleep = 1s
    #    - LLM node Sleep = 1.5s
    #    (Since these run concurrently using gather, this layer takes ~1.5s max, not 3.5s)
    # 3. Logic Node finishes (~0 sec)
    # 4. SHAP Node finishes (~0.5 sec)
    # Expected Duration: ~2 seconds (1.5s + 0.5s)
    
    print("\nAPI Response Code:", response.status_code)
    
    output = response.json()
    state = output.get("engine_state", {})
    logs = state.get("execution_log", [])
    
    print("\nExecution Log Timeline:")
    for log in logs:
        print(f" -> {log}")
    
    assert response.status_code == 200
    assert duration < 2.5, f"Execution took {duration}s. Should take ~2s if async.gather is working!"
    print("\nParallel Async Test passed! asyncio.gather successfully prevented sequential blocking.")

if __name__ == "__main__":
    test_async_execution()
