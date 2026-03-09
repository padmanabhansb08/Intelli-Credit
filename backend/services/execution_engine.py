import asyncio
import logging
import xml.etree.ElementTree as ET
from simpleeval import simple_eval
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

# --- Mock LLM Module (In a real scenario, this connects to backend/modules/llm.py) ---
async def call_groq_llm(prompt: str, model: str) -> Dict[str, Any]:
    """Mock asynchronous call to Groq API"""
    logger.info(f"Initiating async call to Groq using model: {model}")
    await asyncio.sleep(1.5)  # Simulate API latency
    return {"extracted_entities": {"revenue": 5000000, "ebitda": 1200000}}

# --- Context State Object ---
class ExecutionContext:
    def __init__(self, initial_payload: Dict[str, Any]):
        self.state: Dict[str, Any] = {
            "payload": initial_payload,
            "node_outputs": {},
            "execution_log": []
        }
        self._lock = asyncio.Lock()

    async def get_state(self) -> Dict[str, Any]:
        async with self._lock:
            return self.state

    async def set_output(self, node_id: str, output: Any):
        async with self._lock:
            self.state["node_outputs"][node_id] = output
            
    async def log(self, message: str):
        async with self._lock:
            self.state["execution_log"].append(message)


# --- Node Processors ---

async def process_trigger_node(node: Dict[str, Any], context: ExecutionContext):
    await context.log(f"Executing TriggerNode: {node['id']}")
    await context.set_output(node['id'], {"status": "triggered"})

async def process_integration_node(node: Dict[str, Any], context: ExecutionContext):
    await context.log(f"Executing IntegrationNode: {node['id']} - Fetching via {node.get('data', {}).get('connection')}")
    
    # Simulate constructing dynamic XML Request
    applicant = (await context.get_state()).get("payload", {})
    pan = applicant.get("pan_number", "UNKNOWN")
    xml_request = f"<Request><Consumer><PAN>{pan}</PAN></Consumer></Request>"
    await context.log(f"Constructed Equifax XML Payload for {pan}")

    # Simulated External API with rigid asyncio timeout and graceful degradation
    async def _mock_bureau_call():
        await asyncio.sleep(1) # Simulated network latency
        # Simulated raw XML success response
        return f"""
        <Response>
            <Status>SUCCESS</Status>
            <CreditProfile>
                <VantageScore>742</VantageScore>
                <DTIRatio>0.35</DTIRatio>
                <ActiveTradelines>5</ActiveTradelines>
            </CreditProfile>
        </Response>
        """

    try:
        raw_xml_response = await asyncio.wait_for(_mock_bureau_call(), timeout=3.0)
        
        # Parse XML
        root = ET.fromstring(raw_xml_response)
        score = int(root.find('.//VantageScore').text)
        dti = float(root.find('.//DTIRatio').text)
        tradelines = int(root.find('.//ActiveTradelines').text)
        
        parsed_data = {
            "vantage_score": score,
            "dti_ratio": dti,
            "active_tradelines": tradelines,
            "status": "SUCCESS"
        }
        await context.set_output(node['id'], parsed_data)
        await context.log(f"Equifax parse Success. Score: {score}")

    except asyncio.TimeoutError:
        await context.log(f"CRITICAL: Integration {node['id']} timed out. Degrading to Manual Review.")
        await context.set_output(node['id'], {"status": "MANUAL_REVIEW", "error": "timeout"})
    except Exception as e:
        await context.log(f"Integration {node['id']} failed: {str(e)}")
        await context.set_output(node['id'], {"status": "MANUAL_REVIEW", "error": str(e)})

async def process_gst_node(node: Dict[str, Any], context: ExecutionContext):
    await context.log(f"Executing GSTReconciliationNode: {node['id']}")
    
    # Retrieve base data
    payload = (await context.get_state()).get("payload", {})
    stated_revenue = payload.get("loan_amount", 0) * 5 # mock reasonable expectation
    
    try:
        # Simulate fetch of 12 month GSTR-3B filings
        await asyncio.sleep(0.5)
        mock_gstr_3b_monthly = [stated_revenue * 0.08] * 12 # Roughly 96% of stated
        annual_gst_revenue = sum(mock_gstr_3b_monthly)
        
        # Variance calculation = |Stated - Actual GST| / Stated
        if stated_revenue > 0:
            variance = abs(stated_revenue - annual_gst_revenue) / stated_revenue
        else:
            variance = 1.0
            
        tolerance = node.get("data", {}).get("tolerancePercentage", 5.0) / 100.0
        flagged = variance > tolerance

        await context.set_output(node['id'], {
            "annual_gst_revenue": annual_gst_revenue,
            "variance": variance,
            "flagged": flagged
        })
        await context.log(f"GST Reconciled: Variance {variance:.1%}. Flagged: {flagged}")
    except Exception as e:
        await context.log(f"GST math failed: {str(e)}")
        await context.set_output(node['id'], {"status": "MANUAL_REVIEW", "error": str(e)})

async def process_llm_node(node: Dict[str, Any], context: ExecutionContext):
    await context.log(f"Executing DocumentClassificationNode (LLM): {node['id']}")
    model = node.get("data", {}).get("model", "llama3-70b-8192")
    prompt = node.get("data", {}).get("promptTemplate", "Extract data")
    
    # Non-blocking async LLM call
    try:
        result = await asyncio.wait_for(call_groq_llm(prompt, model), timeout=5.0)
        await context.set_output(node['id'], result)
    except asyncio.TimeoutError:
        await context.log("LLM Extractor timed out.")
        await context.set_output(node['id'], {"status": "MANUAL_REVIEW"})

async def process_condition_node(node: Dict[str, Any], context: ExecutionContext):
    await context.log(f"Executing ConditionNode: {node['id']}")
    
    state = await context.get_state()
    # Flatten outputs for easy simpleeval variable name access depending on the expression implementation
    # E.g., `outputs = {"integrationNode1": {"vantage_score": 750}}`
    local_vars = {"context": state["node_outputs"], "payload": state["payload"]}
    
    expression = node.get("data", {}).get("expression", "True")
    
    try:
        # Secure AST AST parsing utilizing simpleeval
        # Evaluates safely strictly without access to arbitrary imports (no RCE)
        decision_bool = simple_eval(expression, names=local_vars)
        await context.log(f"Condition '{expression}' evaluated to: {decision_bool}")
        await context.set_output(node['id'], {"decision_pass": decision_bool})
        
    except Exception as e:
        await context.log(f"Condition parsing failed securely. Routing to fallback. Error: {str(e)}")
        await context.set_output(node['id'], {"decision_pass": False, "error": str(e)})

async def process_shap_node(node: Dict[str, Any], context: ExecutionContext):
    await context.log(f"Executing ExplainableAINode (SHAP): {node['id']}")
    await asyncio.sleep(0.5) # Simulate SHAP calc
    await context.set_output(node['id'], {"top_drivers": ["bureau_score", "ebitda"]})

async def process_mca_node(node: Dict[str, Any], context: ExecutionContext):
    await context.log(f"Executing MCAFilingSyncNode: {node['id']}")
    await asyncio.sleep(0.5) # Simulate Signzy API network delay
    # In a real scenario, this connects to the Signzy MCA V3 APIs
    await context.set_output(node['id'], {
        "status": "success",
        "cin_verified": True,
        "directors": ["John Doe", "Jane Smith"],
        "financials_synced": node.get("data", {}).get("syncFinancials", True)
    })

async def process_epfo_node(node: Dict[str, Any], context: ExecutionContext):
    await context.log(f"Executing EPFOAnomalyNode: {node['id']}")
    await asyncio.sleep(0.5) # Simulate EPFO data retrieval
    tolerance = node.get("data", {}).get("toleranceMonths", 3)
    # Simulate discovering 1 missed month (below default tolerance of 3)
    missed_months = 1
    flagged = missed_months > tolerance
    await context.set_output(node['id'], {
        "status": "success",
        "missed_payments_months": missed_months,
        "flagged": flagged,
        "employer_id": node.get("data", {}).get("employerIdTarget", "UNKNOWN")
    })

# Generic dispatcher
async def execute_node(node: Dict[str, Any], context: ExecutionContext):
    node_type = node.get("type")
    
    if node_type == "triggerNode":
        await process_trigger_node(node, context)
    elif node_type == "integrationNode":
        await process_integration_node(node, context)
    elif node_type == "gstReconciliationNode":
        await process_gst_node(node, context)
    elif node_type == "documentClassificationNode":
        await process_llm_node(node, context)
    elif node_type == "conditionNode":
        await process_condition_node(node, context)
    elif node_type == "explainableAINode":
        await process_shap_node(node, context)
    elif node_type == "mcaFilingSyncNode":
        await process_mca_node(node, context)
    elif node_type == "epfoAnomalyNode":
        await process_epfo_node(node, context)
    else:
        await context.log(f"Unknown node type executed: {node_type} ({node['id']})")
        await context.set_output(node['id'], {"status": "skipped"})


# --- Core Execution Engine ---

class ExecutionEngine:
    def __init__(self, dag_nodes: List[Dict[str, Any]], dag_edges: List[Dict[str, Any]]):
        self.nodes = {n['id']: n for n in dag_nodes}
        self.edges = dag_edges
        
        # Build adjacency and in-degree maps
        self.graph = {n['id']: [] for n in dag_nodes}
        self.in_degree = {n['id']: 0 for n in dag_nodes}
        
        for edge in dag_edges:
            source = edge.get("source")
            target = edge.get("target")
            if source in self.graph and target in self.in_degree:
                self.graph[source].append(target)
                self.in_degree[target] += 1

    async def execute(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        context = ExecutionContext(payload)
        
        # Nodes that have 0 dependencies ready to run
        ready_queue = [node_id for node_id, degree in self.in_degree.items() if degree == 0]
        
        while ready_queue:
            # We gather all currently ready nodes to execute them CONCURRENTLY
            tasks = []
            executing_nodes = list(ready_queue) # copy
            ready_queue.clear()
            
            for node_id in executing_nodes:
                node_data = self.nodes[node_id]
                tasks.append(execute_node(node_data, context))
                
            # Await the parallel execution of this topological "layer"
            await asyncio.gather(*tasks)
            
            # After the layer finishes, decrement in-degrees for children
            for node_id in executing_nodes:
                for target_id in self.graph[node_id]:
                    self.in_degree[target_id] -= 1
                    if self.in_degree[target_id] == 0:
                        ready_queue.append(target_id)
                        
        return await context.get_state()
