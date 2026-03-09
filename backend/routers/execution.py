from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from services.execution_engine import ExecutionEngine
import asyncio

router = APIRouter()

# --- Mock Payload and DB Fetching ---

class ExecutePayload(BaseModel):
    applicant_name: str = "Test Corp"
    pan_number: str = "ABCDE1234F"
    loan_amount: float = 50000.0
    pdf_urls: List[str] = []

from routers.engine import WorkflowNode, WorkflowEdge, check_for_cycles

class DraftExecutionPayload(BaseModel):
    trigger_payload: ExecutePayload
    nodes: List[WorkflowNode] = []
    edges: List[WorkflowEdge] = []

from store import MOCK_MONGODB

# In a real deployed app, this fetch would hit MongoDB: `db.engine_configs.find_one(...)`
def fetch_mock_dag_for_policy(policy_id: str) -> dict:
    # Look for dynamically deployed workflow ID first
    if policy_id in MOCK_MONGODB:
        return MOCK_MONGODB[policy_id]
        
    # Fallback to hardcoded mock for legacy paths or system checks
    if policy_id == "mock_policy":
        return {
            "nodes": [
                {"id": "node_trigger", "type": "triggerNode", "data": {}},
                {"id": "node_Integration1", "type": "integrationNode", "data": {"connection": "Equifax"}},
                {"id": "node_Integration2", "type": "gstReconciliationNode", "data": {}},
                {"id": "node_LLM", "type": "documentClassificationNode", "data": {"model": "llama3-70b-8192"}},
                {"id": "node_Logic", "type": "conditionNode", "data": {
                    "expression": "context['node_Integration1']['vantage_score'] > 700 and context['node_Integration2']['variance'] < 0.10"
                }},
                {"id": "node_SHAP", "type": "explainableAINode", "data": {}}
            ],
            "edges": [
                # Trigger goes to Integration 1 & 2 concurrently (Parallel Split)
                {"id": "e1", "source": "node_trigger", "target": "node_Integration1"},
                {"id": "e2", "source": "node_trigger", "target": "node_Integration2"},
                
                # Integration 2 also needs LLM evaluation concurrently
                {"id": "e3", "source": "node_trigger", "target": "node_LLM"},
                
                # Logic evaluates ALL three branches
                {"id": "e4", "source": "node_Integration1", "target": "node_Logic"},
                {"id": "e5", "source": "node_Integration2", "target": "node_Logic"},
                {"id": "e6", "source": "node_LLM", "target": "node_Logic"},
                
                # SHAP evaluates the logic
                {"id": "e7", "source": "node_Logic", "target": "node_SHAP"}
            ]
        }
    return {}


# NOTE: Routes are ordered specifically - more specific routes must come before parameterized routes
# The -draft and /execute-draft endpoints are defined first, then the wildcard {policy_id} comes last


@router.post("/execute-draft", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
async def execute_draft_workflow_v2(payload: DraftExecutionPayload):
    """
    Ephemeral Draft Execution - Alternative endpoint path for Decision Studio.
    Accepts raw DAG payload directly without MongoDB lookup.
    Validates the DAG using topological sort and executes in memory.
    """
    
    # 1. Topological Sort (Kahn's Algorithm) to detect cycles
    cycle_nodes = check_for_cycles(payload.nodes, payload.edges)
    if cycle_nodes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Invalid Workflow: Cycle detected in nodes.",
                "cycle_nodes": cycle_nodes,
                "message": "Please remove the circular dependency in your workflow graph and try again."
            }
        )
        
    # 2. Execute in memory without database persistence
    engine = ExecutionEngine(
        dag_nodes=[node.dict() for node in payload.nodes],
        dag_edges=[edge.dict() for edge in payload.edges]
    )
    
    # 3. Run the execution
    try:
        final_context_state = await engine.execute(payload.trigger_payload.dict())
        return {
            "status": "success",
            "execution_mode": "ephemeral_draft",
            "policy_id": f"draft_{int(__import__('time').time() * 1000)}",
            "engine_state": final_context_state,
            "nodes_processed": len(payload.nodes),
            "edges_processed": len(payload.edges)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Engine execution failed",
                "message": str(e)
            }
        )


# This route must come LAST as it's a wildcard that matches everything
@router.post("/{policy_id}", response_model=Dict[str, Any], status_code=status.HTTP_200_OK)
async def execute_engine_workflow(policy_id: str, payload: ExecutePayload):
    """
    Retrieves the DAG topology for the requested policy and triggers
    the asynchronous ExecutionEngine.
    """
    
    dag_config = fetch_mock_dag_for_policy(policy_id)
    if not dag_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Policy DAG with ID {policy_id} not found."
        )
        
    engine = ExecutionEngine(
        dag_nodes=dag_config["nodes"],
        dag_edges=dag_config["edges"]
    )
    
    # Execute the Engine asynchronously across the DAG levels
    try:
        final_context_state = await engine.execute(payload.dict())
        return {
            "status": "success",
            "policy_id": policy_id,
            "engine_state": final_context_state
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Engine execution failed: {str(e)}"
        )
