"""
Simulation API Router
========================
FastAPI routes for the MiroFish multi-agent simulation engine.

Endpoints
---------
POST /api/sim/analyze-and-simulate  → Launches full pipeline + background simulation
GET  /api/sim/stream/{task_id}      → SSE stream of real-time agent interactions
POST /api/sim/interact-agent        → Human underwriter queries a simulated agent
POST /api/sim/generate-cam          → Generate unified CAM document with simulation
GET  /api/sim/status/{task_id}      → Get current simulation status
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel, Field

from simulation.graph_builder import build_knowledge_graph, setup_simulation_environment
from simulation.engine import (
    ScenarioParams,
    SimulationEngine,
    SimulationResult,
    get_simulation_state,
    interact_with_agent,
)
from simulation.report_agent import ReportAgent
from core.parser import generate_seed_material
from core.researcher import enrich_seed_with_research
from core.scorer import calculate_base_score, apply_resilience_modifier
from core.report_generator import generate_unified_cam

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sim", tags=["simulation"])

# ---------------------------------------------------------------------------
# In-memory storage for completed simulation results
# ---------------------------------------------------------------------------
_completed_results: Dict[str, SimulationResult] = {}
_analysis_cache: Dict[str, Dict[str, Any]] = {}


# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------
class SimulateRequest(BaseModel):
    """Request body for launching a simulation."""
    parsed_data: Dict[str, Any] = Field(default_factory=dict, description="Parsed financial data from ingestion")
    research_data: Optional[Dict[str, Any]] = Field(None, description="OSINT research data")
    shock_description: str = "A 25% unexpected tariff on primary imported materials"
    shock_type: str = "supply_chain"
    shock_severity: float = 0.25
    simulation_rounds: int = 20
    deep_scan: bool = False


class InteractRequest(BaseModel):
    """Request body for interacting with a simulated agent."""
    task_id: str
    agent_id: str
    query: str


class GenerateCamRequest(BaseModel):
    """Request body for generating the unified CAM."""
    task_id: str
    analysis_data: Dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Background task runner
# ---------------------------------------------------------------------------
async def _run_simulation_pipeline(
    task_id: str,
    parsed_data: Dict[str, Any],
    research_data: Optional[Dict[str, Any]],
    scenario: ScenarioParams,
    deep_scan: bool,
) -> None:
    """Background task: full pipeline from seed → graph → simulation → scoring."""
    try:
        # Step 1: Generate seed material
        logger.info(f"[{task_id}] Step 1: Generating seed material...")
        company_name = parsed_data.get("company_name", parsed_data.get("applicant_name", "Company"))
        enriched_data, seed_text = await generate_seed_material(parsed_data, research_data)

        # Step 2: Enrich with deep research (if enabled)
        if deep_scan:
            logger.info(f"[{task_id}] Step 2: Enriching with deep research...")
            enriched_research = await enrich_seed_with_research(
                company_name, research_data, deep_scan=True
            )
            enriched_data["research_findings"] = enriched_research
            if enriched_research.get("simulation_enrichment"):
                seed_text += f"\n\n--- DEEP SCAN ENRICHMENT ---\n{enriched_research['simulation_enrichment']}"

        # Step 3: Build knowledge graph
        logger.info(f"[{task_id}] Step 3: Building knowledge graph...")
        knowledge_graph = await build_knowledge_graph(seed_text)

        # Step 4: Setup simulation environment
        logger.info(f"[{task_id}] Step 4: Setting up simulation environment...")
        sim_env = await setup_simulation_environment(knowledge_graph)

        # Step 5: Run simulation
        logger.info(f"[{task_id}] Step 5: Running stress test simulation...")
        engine = SimulationEngine(sim_env, scenario, task_id=task_id)
        result = await engine.run_stress_test_simulation()
        _completed_results[task_id] = result

        # Step 6: Generate resilience modifier
        logger.info(f"[{task_id}] Step 6: Generating resilience modifier...")
        report_agent = ReportAgent(result)
        modifier = await report_agent.generate_resilience_modifier()

        # Step 7: Calculate final score
        base_score = calculate_base_score(enriched_data.get("financial_data", enriched_data.get("extracted_fields", {})))
        final_score = apply_resilience_modifier(
            base_score,
            modifier.capacity_modifier,
            modifier.conditions_modifier,
            modifier.confidence,
            modifier.rationale,
        )

        # Cache full analysis
        _analysis_cache[task_id] = {
            "company_name": company_name,
            "score": final_score.model_dump(),
            "modifier": modifier.model_dump(),
            "financial_data": enriched_data.get("financial_data", enriched_data.get("extracted_fields", {})),
            "research_findings": enriched_data.get("research_findings"),
            "graph_metadata": knowledge_graph.metadata,
            "simulation_metadata": result.metadata,
        }

        logger.info(f"[{task_id}] Pipeline complete. Final score: {final_score.final_score:.1f}")

    except Exception as exc:
        logger.error(f"[{task_id}] Simulation pipeline failed: {exc}")
        # Update simulation state if possible
        state = get_simulation_state(task_id)
        if state:
            state.status = "failed"
            state.error = str(exc)[:500]


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------
@router.post("/analyze-and-simulate")
async def analyze_and_simulate(
    request: SimulateRequest,
    background_tasks: BackgroundTasks,
) -> Dict[str, Any]:
    """Launch the full analysis + simulation pipeline.

    Returns a task_id for streaming updates via SSE.
    """
    task_id = uuid.uuid4().hex[:16]

    scenario = ScenarioParams(
        shock_description=request.shock_description,
        shock_type=request.shock_type,
        severity=request.shock_severity,
        duration_rounds=request.simulation_rounds,
    )

    background_tasks.add_task(
        _run_simulation_pipeline,
        task_id=task_id,
        parsed_data=request.parsed_data,
        research_data=request.research_data,
        scenario=scenario,
        deep_scan=request.deep_scan,
    )

    return {
        "task_id": task_id,
        "status": "started",
        "message": f"Simulation pipeline launched with {request.simulation_rounds} rounds",
        "stream_url": f"/api/sim/stream/{task_id}",
    }


@router.get("/stream/{task_id}")
async def stream_simulation(task_id: str) -> StreamingResponse:
    """SSE endpoint for real-time simulation progress streaming."""

    async def event_generator():
        max_wait = 120  # seconds
        waited = 0

        # Wait for simulation to start
        while waited < max_wait:
            state = get_simulation_state(task_id)
            if state:
                break
            await asyncio.sleep(0.5)
            waited += 0.5

        if not get_simulation_state(task_id):
            yield f"data: {json.dumps({'event': 'error', 'message': 'Simulation not found'})}\n\n"
            return

        state = get_simulation_state(task_id)
        last_seen = 0

        while state and state.status in ("pending", "running"):
            current_count = len(state.interactions)
            if current_count > last_seen:
                for interaction in state.interactions[last_seen:current_count]:
                    event_data = {
                        "event": "interaction",
                        "round": interaction.round_number,
                        "speaker": interaction.speaker_name,
                        "speaker_id": interaction.speaker_agent_id,
                        "message": interaction.message,
                        "type": interaction.interaction_type,
                        "impact": interaction.financial_impact,
                    }
                    yield f"data: {json.dumps(event_data)}\n\n"
                last_seen = current_count

                # State update
                state_event = {
                    "event": "state_update",
                    "round": state.current_round,
                    "total_rounds": state.total_rounds,
                    "resilience": state.applicant_resilience_score,
                    "status": state.status,
                }
                yield f"data: {json.dumps(state_event)}\n\n"

            await asyncio.sleep(0.5)
            state = get_simulation_state(task_id)

        # Final event
        final_state = get_simulation_state(task_id)
        cached = _analysis_cache.get(task_id, {})
        final_event = {
            "event": "simulation_complete",
            "task_id": task_id,
            "status": final_state.status if final_state else "unknown",
            "final_resilience": final_state.applicant_resilience_score if final_state else 0,
            "total_interactions": len(final_state.interactions) if final_state else 0,
            "final_score": cached.get("score", {}).get("final_score"),
            "recommendation": cached.get("score", {}).get("recommendation"),
            "error": final_state.error if final_state else None,
        }
        yield f"data: {json.dumps(final_event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/status/{task_id}")
async def get_status(task_id: str) -> Dict[str, Any]:
    """Get the current status of a simulation."""
    state = get_simulation_state(task_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Simulation {task_id} not found")

    cached = _analysis_cache.get(task_id, {})

    return {
        "task_id": task_id,
        "status": state.status,
        "current_round": state.current_round,
        "total_rounds": state.total_rounds,
        "resilience_score": state.applicant_resilience_score,
        "total_interactions": len(state.interactions),
        "error": state.error,
        "score": cached.get("score"),
        "graph_metadata": cached.get("graph_metadata"),
    }


@router.post("/interact-agent")
async def interact_agent(request: InteractRequest) -> Dict[str, Any]:
    """Query a specific simulated agent as a human underwriter."""
    state = get_simulation_state(request.task_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Simulation {request.task_id} not found")

    result = await interact_with_agent(
        task_id=request.task_id,
        agent_id=request.agent_id,
        user_query=request.query,
    )

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result


@router.post("/generate-cam")
async def generate_cam(request: GenerateCamRequest) -> Response:
    """Generate a unified CAM document including simulation analysis."""
    task_id = request.task_id
    cached = _analysis_cache.get(task_id, {})

    # Merge provided analysis data with cached data
    analysis = {**cached, **request.analysis_data}
    if not analysis.get("company_name"):
        analysis["company_name"] = request.analysis_data.get(
            "company_name", cached.get("company_name", "Applicant")
        )

    # Build simulation data section
    simulation_data = None
    result = _completed_results.get(task_id)
    if result:
        try:
            report_agent = ReportAgent(result)
            stress_report = await report_agent.generate_stress_analysis_report()
            simulation_data = {
                "stress_report": stress_report.model_dump(),
                "modifier": stress_report.resilience_modifier.model_dump(),
                "scenario": result.scenario.model_dump(),
            }
        except Exception as exc:
            logger.error(f"Stress report generation failed: {exc}")
            simulation_data = {
                "modifier": cached.get("modifier", {}),
                "scenario": {"shock_description": "Stress test scenario"},
            }

    # Generate the document
    docx_bytes = generate_unified_cam(analysis, simulation_data)
    if not docx_bytes:
        raise HTTPException(status_code=500, detail="CAM generation failed. Ensure python-docx is installed.")

    company = analysis.get("company_name", "applicant")
    filename = f"CAM_{company.replace(' ', '_')}_SimEnhanced.docx"

    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/agents/{task_id}")
async def list_agents(task_id: str) -> Dict[str, Any]:
    """List all agents in a simulation for the chat UI."""
    state = get_simulation_state(task_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Simulation {task_id} not found")

    agents = []
    seen_ids = set()
    for interaction in state.interactions:
        if interaction.speaker_agent_id not in seen_ids:
            seen_ids.add(interaction.speaker_agent_id)
            agent_state = state.agent_states.get(interaction.speaker_agent_id, {})
            agents.append({
                "agent_id": interaction.speaker_agent_id,
                "name": interaction.speaker_name,
                "role": agent_state.get("role", "unknown"),
                "interaction_count": sum(
                    1 for i in state.interactions if i.speaker_agent_id == interaction.speaker_agent_id
                ),
            })

    return {
        "task_id": task_id,
        "agents": agents,
        "total_agents": len(agents),
    }
