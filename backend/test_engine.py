from fastapi.testclient import TestClient
from main import app
import json

client = TestClient(app)

def test_valid_dag():
    payload = {
        "nodes": [
            {
                "id": "1",
                "type": "triggerNode",
                "position": {"x": 0, "y": 0},
                "data": {
                    "triggerType": "manual",
                    "payloadTemplate": "{}"
                }
            },
            {
                "id": "2",
                "type": "conditionNode",
                "position": {"x": 100, "y": 100},
                "data": {
                    "expression": "x > 5",
                    "targetField": "result",
                    "defaultValue": "0"
                }
            }
        ],
        "edges": [
            {
                "id": "e1-2",
                "source": "1",
                "target": "2"
            }
        ]
    }
    
    response = client.post("/api/v1/engine/deploy", json=payload)
    print("Valid DAG Status:", response.status_code)
    print("Valid DAG Response:", response.json())
    assert response.status_code == 201

def test_cycle_dag():
    payload = {
        "nodes": [
            {
                "id": "1",
                "type": "triggerNode",
                "position": {"x": 0, "y": 0},
                "data": {
                    "triggerType": "manual",
                    "payloadTemplate": "{}"
                }
            },
            {
                "id": "2",
                "type": "conditionNode",
                "position": {"x": 100, "y": 100},
                "data": {
                    "expression": "x > 5",
                    "targetField": "result",
                    "defaultValue": "0"
                }
            }
        ],
        "edges": [
            {
                "id": "e1-2",
                "source": "1",
                "target": "2"
            },
            {
                "id": "e2-1",
                "source": "2",
                "target": "1" # creates cycle!
            }
        ]
    }
    
    response = client.post("/api/v1/engine/deploy", json=payload)
    print("Cycle DAG Status:", response.status_code)
    print("Cycle DAG Response:", response.json())
    assert response.status_code == 400
    assert "Cycle" in str(response.json()) or "Circular" in str(response.json())

def test_invalid_schema():
    payload = {
        "nodes": [
            {
                "id": "1",
                "type": "conditionNode",
                "position": {"x": 100, "y": 100},
                "data": {
                    # Missing expression Field!
                    "targetField": "result",
                    "defaultValue": "0"
                }
            }
        ],
        "edges": []
    }
    
    response = client.post("/api/v1/engine/deploy", json=payload)
    print("Invalid Schema Status:", response.status_code)
    print("Invalid Schema Response:", response.json())
    assert response.status_code == 422

if __name__ == "__main__":
    print("Running Engine Tests...")
    test_valid_dag()
    print("-" * 50)
    test_cycle_dag()
    print("-" * 50)
    test_invalid_schema()
    print("All tests passed!")
