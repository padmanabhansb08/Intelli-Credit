from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from research_agent import ResearchAgent

router = APIRouter()

class ResearchRequest(BaseModel):
    entity_name: str

class ResearchResponse(BaseModel):
    entity: str
    summary: str
    risk_score: int

@router.post("/research-agent", response_model=ResearchResponse)
async def research_endpoint(request: ResearchRequest):
    agent = ResearchAgent()
    try:
        result = await agent.run(request.entity_name)
        return ResearchResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
