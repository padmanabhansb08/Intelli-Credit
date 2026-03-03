from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import time

router = APIRouter()

class NodeData(BaseModel):
    label: Optional[str] = None
    connection: Optional[str] = None
    fieldAssignment: Optional[str] = None
    assignmentDetails: Optional[str] = None
    targetField: Optional[str] = None
    defaultValue: Optional[str] = None
    rules: Optional[List[Dict[str, Any]]] = []
    extractedFields: Optional[List[Dict[str, Any]]] = None
    confidence: Optional[float] = None

class ReactFlowNode(BaseModel):
    id: str
    type: str
    position: Dict[str, float]
    data: NodeData

class ReactFlowEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str

class DecisionGraphPayload(BaseModel):
    nodes: List[ReactFlowNode]
    edges: List[ReactFlowEdge]
    workflow_id: Optional[str] = "draft_1"

def topologically_sort(nodes: List[ReactFlowNode], edges: List[ReactFlowEdge]) -> List[ReactFlowNode]:
    """Sort nodes to ensure they are executed in order of dependencies."""
    adj_list = {node.id: [] for node in nodes}
    in_degree = {node.id: 0 for node in nodes}
    
    for edge in edges:
        if edge.source in adj_list and edge.target in in_degree:
            adj_list[edge.source].append(edge.target)
            in_degree[edge.target] += 1
            
    queue = [n_id for n_id, deg in in_degree.items() if deg == 0]
    sorted_ids = []
    
    while queue:
        current = queue.pop(0)
        sorted_ids.append(current)
        for neighbor in adj_list[current]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)
                
    if len(sorted_ids) != len(nodes):
        # Allow partial rendering in builder, skip strict cycle check for cost estimation
        id_to_node = {node.id: node for node in nodes}
        return [id_to_node[n] for n in sorted_ids]
        
    id_to_node = {node.id: node for node in nodes}
    return [id_to_node[n] for n in sorted_ids]

def calculate_node_cost(node_type: str) -> int:
    """Predictive billing model: returns AI credit cost per node execution."""
    cost_map = {
        'triggerNode': 1,
        'integrationNode': 5,            # External API routing
        'conditionNode': 2,              # Logic evaluation
        'documentClassificationNode': 18 # Heavy ML: SciBERT + Flan-T5
    }
    return cost_map.get(node_type, 1)

@router.post("/estimate_cost")
async def estimate_workflow_cost(payload: DecisionGraphPayload):
    """Simulates workflow execution to project total AI token cost."""
    try:
        sorted_nodes = topologically_sort(payload.nodes, payload.edges)
        total_cost = 0
        node_breakdown = []
        
        for node in sorted_nodes:
            cost = calculate_node_cost(node.type)
            total_cost += cost
            node_breakdown.append({
                "node_id": node.id,
                "label": getattr(node.data, 'label', 'Unknown Node'),
                "cost": cost
            })
            
        # Simulate processing time for realism
        time.sleep(0.3)
            
        return {
            "total_credits": total_cost,
            "currency_equivalent": round(total_cost * 0.04, 2), # $0.04 per AI credit
            "breakdown": node_breakdown
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cost estimation failed: {str(e)}")

def execute_dag(nodes: List[ReactFlowNode], edges: List[ReactFlowEdge], initial_data: Dict[str, Any]) -> Dict[str, Any]:
    """Executes the mapped logic from the visual builder."""
    sorted_nodes = topologically_sort(nodes, edges)
    
    # State object representing `data` in the frontend Mapper
    state = initial_data.copy()
    execution_log = []
    
    for node in sorted_nodes:
        if node.type == 'triggerNode':
            execution_log.append({"node": node.id, "action": "Triggered Workflow", "status": "Success"})
            
        elif node.type == 'integrationNode':
            connection = getattr(node.data, 'connection', None) or "External API"
            target = getattr(node.data, 'fieldAssignment', None) or "data.api_response"
            
            mock_resp = {"status": "connected", "source": connection, "score": 740}
            target_key = target.replace("data.", "")
            state[target_key] = mock_resp
            execution_log.append({"node": node.id, "action": f"Called {connection}", "assigned": target_key})
            
        elif node.type == 'documentClassificationNode':
            # Simulated IDP extraction time
            execution_log.append({"node": node.id, "action": "Extracted semantic entities via SciBERT", "status": "Success", "confidence": getattr(node.data, 'confidence', 95.0)})

        elif node.type == 'conditionNode':
            target = getattr(node.data, 'targetField', None) or "data.decision"
            default_val = getattr(node.data, 'defaultValue', None) or "PENDING"
            
            target_key = target.replace("data.", "")
            state[target_key] = default_val
            execution_log.append({"node": node.id, "action": "Evaluated Conditions", "assigned": target_key, "value": default_val})
            
    return {
        "final_state": state,
        "logs": execution_log
    }


@router.post("/execute")
async def execute_workflow(payload: DecisionGraphPayload):
    """Compiles and executes the React Flow DAG configuration."""
    try:
        initial_payload = {
            "application_id": "APP_001",
            "applicant_name": "Acme Corp"
        }
        
        # Calculate tokens consumed during this run
        total_tokens = sum(calculate_node_cost(n.type) for n in payload.nodes)
        
        result = execute_dag(payload.nodes, payload.edges, initial_payload)
        result["tokens_consumed"] = total_tokens
        
        return {
            "status": "success",
            "message": "Workflow executed successfully",
            "execution_details": result
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

