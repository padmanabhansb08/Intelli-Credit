import os
import asyncio
import json
from typing import Dict, Any, List
from tavily import AsyncTavilyClient
from groq import AsyncGroq

# Retrieve API keys from the environment
TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

async def conduct_osint_research(company_name: str) -> Dict[str, Any]:
    """
    Executes an autonomous OSINT research workflow for a given company.
    Queries the web using Tavily for NCLT proceedings, fraud litigation, and recent news.
    Passes the concatenated results to Groq to extract a definitive NCLT flag and source URLs.
    """
    if not TAVILY_API_KEY or not GROQ_API_KEY:
        print("Warning: TAVILY_API_KEY or GROQ_API_KEY is missing. Returning fallback OSINT data.")
        return {
            "nclt_flag": False,
            "source_urls": [],
            "raw_summary": "API Keys missing for Tavily or Groq."
        }

    tavily_client = AsyncTavilyClient(api_key=TAVILY_API_KEY)
    groq_client = AsyncGroq(api_key=GROQ_API_KEY)

    # 1. Program three specific boolean queries
    queries = [
        f'"{company_name}" NCLT insolvency proceedings OR IBC bankruptcy',
        f'"{company_name}" OR fraud litigation CBI ED investigation',
        f'"{company_name}" recent news Economic Times Mint'
    ]

    print(f"Executing deep secondary research for: {company_name}")
    
    concatenated_results = []
    source_urls = set()

    # Execute queries concurrently
    tasks = [
        tavily_client.search(query=q, search_depth="advanced", max_results=3)
        for q in queries
    ]
    
    try:
        search_responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        for idx, response in enumerate(search_responses):
            if isinstance(response, Exception):
                print(f"Search query {idx + 1} failed: {response}")
                continue
                
            for result in response.get("results", []):
                content = result.get("content", "")
                url = result.get("url", "")
                if content:
                    concatenated_results.append(content)
                if url:
                    source_urls.add(url)
                    
    except Exception as e:
        print(f"Tavily search execution failed: {e}")

    aggregated_context = "\n\n".join(concatenated_results)
    
    if not aggregated_context:
        return {
            "nclt_flag": False,
            "source_urls": [],
            "raw_summary": "No critical findings discovered on the web."
        }

    # 2. Pass the aggregated context to Groq to structure the output
    prompt = f"""
    You are an expert Indian OSINT financial risk investigator. Analyze the following web search excerpts gathered for the company "{company_name}".
    
    Your exact task: Determine if there is any definitive evidence or high-probability indication of NCLT (National Company Law Tribunal) insolvency proceedings, IBC bankruptcy, or severe financial fraud/litigation. 
    
    Return your findings STRICTLY in the following JSON format without any markdown blocks or reasoning text outside the JSON:
    {{
        "nclt_flag": boolean,
        "nclt_score": integer (0 to 100 on severity/confidence),
        "risk_summary": "Brief 2-sentence summary of the worst findings."
    }}
    
    Web Search Excerpts:
    {aggregated_context[:12000]}  # Limit context token window
    """

    try:
        chat_completion = await groq_client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You output only structured JSON.",
                },
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            model="llama3-8b-8192",  # Fast and reliable Groq model
            temperature=0.0,
        )
        
        response_text = chat_completion.choices[0].message.content
        extracted_data = json.loads(response_text)
        
        # Merge the requested format
        return {
            "nclt_flag": bool(extracted_data.get("nclt_flag", False)),
            "source_urls": list(source_urls),
            "nclt_score": extracted_data.get("nclt_score", 0),
            "risk_summary": extracted_data.get("risk_summary", "")
        }
        
    except Exception as e:
        print(f"Groq LLM interpretation failed: {e}")
        return {
            "nclt_flag": False,
            "source_urls": list(source_urls),
            "risk_summary": "Failed to parse OSINT context through LLM."
        }
