from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Dict, Union, Any, Optional, Literal, Annotated

router = APIRouter()

from store import MOCK_MONGODB

# --- Polymorphic Pydantic Models for Node Data ---

class BaseNodeData(BaseModel):
    label: Optional[str] = None

class TriggerNodeData(BaseNodeData):
    triggerType: str = Field(..., description="E.g., manual, webhook")
    payloadTemplate: str = Field(..., description="JSON template string")

class IntegrationNodeData(BaseNodeData):
    connection: str = Field(..., description="E.g., Risk API Gateway")
    fieldAssignment: str = Field(..., description="Output mapping target")
    requestBody: str = Field(..., description="Request template")
    mockResponse: Optional[Dict[str, Any]] = None
    outputMapping: Optional[Dict[str, Any]] = None
    fieldMappings: Optional[List[Dict[str, Any]]] = None

class GSTReconciliationNodeData(BaseNodeData):
    gstSource: str
    bankSource: str
    tolerancePercentage: float
    flagAnomalies: bool

class DocumentClassificationNodeData(BaseNodeData):
    model: str = Field(..., description="E.g., llama3-70b-8192")
    promptTemplate: str
    confidenceThreshold: float
    confidence: Optional[float] = None
    extractedFields: Optional[List[Dict[str, str]]] = None

class ConditionNodeData(BaseNodeData):
    expression: str = Field(..., description="Logic expression to evaluate")
    targetField: str
    defaultValue: str
    assignmentDetails: Optional[str] = None

class ExplainableAINodeData(BaseNodeData):
    modelReference: str
    topK: int
    baselineDataset: str
    shapValues: Optional[List[Dict[str, Any]]] = None

class MCAFilingSyncNodeData(BaseNodeData):
    cinTarget: str
    syncDirectors: bool = True
    syncFinancials: bool = True

class EPFOAnomalyNodeData(BaseNodeData):
    employerIdTarget: str
    toleranceMonths: int

# Fallback generic data for nodes not cleanly matched (or basic nodes)
class GenericNodeData(BaseModel):
    pass

# --- Polymorphic Node Models ---

class BaseWorkflowNode(BaseModel):
    id: str
    position: Dict[str, float]

class TriggerNode(BaseWorkflowNode):
    type: Literal["triggerNode"]
    data: TriggerNodeData

class IntegrationNode(BaseWorkflowNode):
    type: Literal["integrationNode"]
    data: IntegrationNodeData

class GSTReconciliationNode(BaseWorkflowNode):
    type: Literal["gstReconciliationNode"]
    data: GSTReconciliationNodeData

class DocumentClassificationNode(BaseWorkflowNode):
    type: Literal["documentClassificationNode"]
    data: DocumentClassificationNodeData

class ConditionNode(BaseWorkflowNode):
    type: Literal["conditionNode"]
    data: ConditionNodeData

class ExplainableAINode(BaseWorkflowNode):
    type: Literal["explainableAINode"]
    data: ExplainableAINodeData

class MCAFilingSyncNode(BaseWorkflowNode):
    type: Literal["mcaFilingSyncNode"]
    data: MCAFilingSyncNodeData

class EPFOAnomalyNode(BaseWorkflowNode):
    type: Literal["epfoAnomalyNode"]
    data: EPFOAnomalyNodeData

# Discriminator pattern using 'type' field
WorkflowNode = Annotated[
    Union[
        TriggerNode,
        IntegrationNode,
        GSTReconciliationNode,
        DocumentClassificationNode,
        ConditionNode,
        ExplainableAINode,
        MCAFilingSyncNode,
        EPFOAnomalyNode
    ],
    Field(discriminator="type")
]

# Workaround for FastAPI not fully supporting Annotated in all older Pydantic versions
# Instead, we define edge and deployment schemas.

class WorkflowEdge(BaseModel):
    id: str
    source: str
    target: str
    type: Optional[str] = 'smoothstep'
    sourceHandle: Optional[str] = None
    targetHandle: Optional[str] = None

class DeployEnginePayload(BaseModel):
    workflow_id: str
    nodes: List[WorkflowNode]
    edges: List[WorkflowEdge]

# --- Kahn's Cycle Detection Algorithm ---

def check_for_cycles(nodes: List[Any], edges: List[WorkflowEdge]) -> Optional[List[str]]:
    """
    Implements Kahn's Algorithm for Topological Sorting to detect cycles in a DAG.
    Returns None if the graph is a valid DAG.
    Returns a list of Node IDs involved in the cycle if a loop is detected.
    """
    # 1. Build adjacency list and in-degree map
    in_degree = {node.id if hasattr(node, "id") else node["id"]: 0 for node in nodes}
    graph = {node.id if hasattr(node, "id") else node["id"]: [] for node in nodes}
    
    for edge in edges:
        source = edge.source
        target = edge.target
        if source in graph and target in in_degree:
            graph[source].append(target)
            in_degree[target] += 1
            
    # 2. Add all nodes with in-degree 0 to the queue
    queue = [node_id for node_id, degree in in_degree.items() if degree == 0]
    visited_count = 0
    
    # 3. Process queue
    while queue:
        current = queue.pop(0)
        visited_count += 1
        
        for neighbor in graph[current]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)
                
    # 4. If visited_count != total nodes, there is a cycle
    if visited_count != len(nodes):
        # Identify nodes that are stuck in the cycle (in-degree > 0)
        cycle_nodes = [node_id for node_id, degree in in_degree.items() if degree > 0]
        return cycle_nodes
        
    return None

# --- Deploy API Endpoint ---

@router.post("/deploy", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def deploy_engine(payload: DeployEnginePayload):
    """
    Validates a Workflow DAG topology and strict polymorphic node schemas.
    Serializes to generic output if successful.
    """
    
    # 1. topological Sort (Kahn's Algorithm) to find loops
    cycle_nodes = check_for_cycles(payload.nodes, payload.edges)
    if cycle_nodes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "DAG Topology Error: Circular dependency detected.",
                "cycle_nodes": cycle_nodes
            }
        )
        
    # 2. Mock MongoDB Serialization (If this was real, we'd persist the DAG)
    payload_dict = payload.dict()
    # Serialize the topological objects for execution layer
    MOCK_MONGODB[payload.workflow_id] = {
        "nodes": payload_dict["nodes"],
        "edges": payload_dict["edges"]
    }

    serialized_config = {
        "status": "success",
        "message": "Engine configuration rigorously validated and deployed.",
        "nodes_processed": len(payload.nodes),
        "edges_processed": len(payload.edges),
        "workflow_id": payload.workflow_id
    }
    
    return serialized_config
