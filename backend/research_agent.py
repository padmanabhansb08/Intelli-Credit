import os
from typing import List, Dict
import httpx
from langchain_openai import OpenAI
from langchain_core.prompts import PromptTemplate
from tavily import TavilyClient

class ResearchAgent:
    def __init__(self):
        # Initialize LLM (ensure OPENAI_API_KEY is set in environment)
        self.llm = OpenAI(model="gpt-4o-mini")
        self.search = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

    def _search(self, query: str) -> List[Dict]:
        """Perform a Tavily search and return result list."""
        return self.search.search(query, max_results=5)

    def _synthesize(self, entity: str, results: List[Dict]) -> str:
        """Summarize search results into a markdown block using the LLM."""
        template = PromptTemplate(
            input_variables=["entity", "results"],
            template=(
                "You are a research analyst. Summarize the findings for {entity} focusing on "
                "regulatory headwinds, promoter controversies, and negative news sentiment. "
                "Provide a concise markdown block."
            ),
        )
        prompt = template.format(entity=entity, results=results)
        return self.llm.invoke(prompt)

    def _risk_score(self, summary: str) -> int:
        """Simple heuristic risk score based on presence of negative keywords."""
        negatives = ["lawsuit", "fraud", "penalty", "investigation", "negative", "risk"]
        score = sum(word in summary.lower() for word in negatives) * 20
        return max(1, min(score, 100))

    async def run(self, entity: str) -> Dict:
        queries = [
            f"{entity} regulatory headwinds",
            f"{entity} promoter controversies",
            f"{entity} negative news sentiment",
        ]
        all_results = []
        async with httpx.AsyncClient() as client:
            for q in queries:
                resp = await client.get(
                    self.search.base_url,
                    params={"q": q, "api_key": os.getenv("TAVILY_API_KEY"), "max_results": 5},
                )
                all_results.extend(resp.json().get("results", []))
        summary = self._synthesize(entity, all_results)
        score = self._risk_score(summary)
        return {"entity": entity, "summary": summary, "risk_score": score}
