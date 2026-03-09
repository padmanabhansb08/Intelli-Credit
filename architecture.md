# Intelli-Credit System Architecture

This document outlines the architecture, data flow, and technology stack for the Intelli-Credit decisioning engine.

## Architecture Diagram (Mermaid.js)

```mermaid
graph TD
    %% Define external sources
    subgraph External Sources
        DB[Databricks Lakehouse] --> |Structured/Unstructured Data| INGEST
        WEB[Web Crawlers & APIs] --> |News & Legal Data| RESEARCH
        USER[B2B/B2C SaaS UI Portal] --> |Primary Insights| API
    end

    %% Define Core Services
    subgraph Intelli-Credit Core Engine [Docker / K8s Containerized]
        API(API Gateway / FastAPI)
        
        subgraph Pipeline Modules
            INGEST(Ingestion & Processing Pipeline)
            RESEARCH(Research Agent / Web Crawler)
            ML(ML Recommendation Engine)
            SYNTHESIS(Risk Synthesis)
            CAM(CAM Generator)
        end
    end

    %% Define relationships and data flows
    API --> |Uploads/Requests| INGEST
    API --> |Trigger Research| RESEARCH
    
    INGEST --> |Feature Data| ML
    RESEARCH --> |Sentiment & Risk Signals| SYNTHESIS
    
    USER --> |Override/Insight| ML
    
    ML --> |PD & Limit Predictions| SYNTHESIS
    SYNTHESIS --> |Composite Risk Score| CAM
    
    CAM --> |Structured Report| API
    
    API --> |Output Data| USER
    API --> |JSON Responses| B2B_Clients(External B2B Integrations)

    %% Styling
    classDef external fill:#f9f9f9,stroke:#333,stroke-width:1px;
    classDef core fill:#e1f5fe,stroke:#0288d1,stroke-width:2px;
    class DB,WEB,USER,B2B_Clients external;
    class API,INGEST,RESEARCH,ML,SYNTHESIS,CAM core;
```

## Technology Stack Selection

**Backend API & Microservices:**
- **Framework:** Python 3.11 with FastAPI (High performance, async native, automatic OpenAPI docs).
- **Server:** Uvicorn (ASGI server).

**Data Ingestion & Processing (High Latency Pipeline):**
- **Processor:** Databricks (Lakehouse architecture for handling massive multi-tenant data).
- **Driver:** `databricks-sql-connector` for python or PySpark depending on scale.
- **PDF Parsing (Scanned Indian PDFs):** `pdfplumber` combined with OCR (`tesseract` via `pytesseract` for scanned image-based PDFs common in Indian statutory filings).

**Web Web Crawler / Research Agent:**
- **Crawling/Scraping:** `beautifulsoup4` and `httpx` (async HTTP requests) for general web scraping.
- **Legal & Compliance:** Explicit integrations via APIs (e.g., e-Courts integrations if available, MCA scraping proxy).
- **NLP / Sentiment Analysis:** Can leverage local LLM models or HuggingFace transformers for sentiment analysis on scraped news (mocked in logic wrapper for now).

**ML Recommendation Engine:**
- **Modeling:** `scikit-learn`, `xgboost`, or `lightgbm` for explainable tree-based models (Probability of Default, Credit Limits).
- **Explainability:** `shap` (SHapley Additive exPlanations) to explicitly detail why a rejection or specific limit was recommended.

**Frontend:**
- **Framework:** Next.js (React) for B2B/B2C B2B SaaS portal.

**Containerization & Deployment:**
- **Containers:** Docker.
- **Orchestration:** Kubernetes (K8s) manifests or Docker Compose for local environments.

## Core Component Overview

1.  **Data Ingestion Pipeline (Databricks natively embedded):** Extracts GST filings, ITRs, and Bank statements via Databricks. Parses unstructured annual reports handling GSTR-2A vs 3B nuances.
2.  **Research Agent:** An automated crawler that investigates promoters, MCA filings, and disputes.
3.  **ML Decisioning & Explainability:** Non-black-box model predicting PD and limits, explicitly tied to SHAP values for root-cause analysis (e.g., "Limit reduced by 20% due to ongoing litigation found on e-Courts").
4.  **CAM Generator:** Synthesizes the Five C's into a final document for the B2B API to consume.
