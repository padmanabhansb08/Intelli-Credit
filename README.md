# Intelli-Credit - Intelligent Corporate Underwriting

> An autonomous AI Credit Officer designed to simulate how Tier-1 bank credit committees operate.

Intelli-Credit is an end-to-end B2B credit decisioning platform. It ingests structured and unstructured borrower financial data, conducts autonomous web-scale due diligence, computes an explainable composite risk score using Machine Learning ensembles, simulates stress tests evaluating RAROC capital impact, and automatically generates a structured, downloadable Credit Appraisal Memo (CAM) in PDF format.

## 🔥 Key Differentiators

1.  **"AI Credit Officer" Persona & LLM Integration**: The system isn't just a traditional ML pipeline. It uses **Google Gemini** to extract unstructured data, read financial PDFs, and automatically author conversational narrative summaries for risk and compliance.
2.  **Web-Scale Research Simulation**: Includes NLP sentiment analysis (using FinBERT), regulatory filings intelligence, and ESG scores.
3.  **Modular Decision Studio**: A dynamic workflow engine that allows credit risk managers to visually construct underwriting logic, configure dynamic scoring rules, and trigger external webhooks interactively.
4.  **Capital Impact (RAROC) Simulation**: Elevates from basic scoring to bank portfolio management by assessing Risk-Weighted Assets (RWA) and tier capital requirements.
5.  **SHAP-Based Explainability**: Avoids "black box" models. The top contributing risk drivers are extracted for every decision.

## 🏗 System Architecture

The project consists of a Python FastAPI backend acting as the Machine Learning, LLM, and pipeline orchestration layer, paired with a modern Next.js frontend featuring real-time state synchronization, drag-and-drop workflow canvases, and Firebase authentication.

### Core Modules
*   **Ingestion Engine**: Parses financial PDFs, Bureau JSONs, and Bank Statement CSVs (using Gemini Vision & regex).
*   **Dynamic Scorer & Rules Engine**: Evaluates nested risk rules built via the Decision Studio UI.
*   **LLM Research Agent**: Leverages a LangChain-powered agent to perform RAG-based Vector Search and external intelligence aggregation. 
*   **Risk Synthesis**: Combines ML Probability of Default (Gradient Boosting), qualitative LLM summaries, and macro-economic factors.

## 🚀 Quick Start (Local Development)

### 1. Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # On Windows
pip install -r requirements.txt
```
*Note: A `.env` file is required in the backend containing your `GEMINI_API_KEY`, `POSTGRES_USER`, and database strings for Alembic migrations.*

Run the FastAPI server:
```bash
uvicorn main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*Note: Ensure your `.env.local` contains valid Firebase configuration keys (`NEXT_PUBLIC_FIREBASE_API_KEY`, etc.) for user authentication to function.*

Access the platform at `http://localhost:3000`.

## 🧠 Using the Platform

1.  **Authenticate**: Use the Firebase login page to sign in to the dashboard.
2.  **Upload & Ingest**: Go to the New Proposal flow. Upload a financial PDF or Bureau data. The system uses Gemini Vision for intelligent OCR.
3.  **Build Workflows**: Use the **Decision Studio** to visually drag and drop Risk Policies and Decision Nodes.
4.  **Review the Output**:
    - Observe the final decision (APPROVE / CONDITIONAL / REJECT).
    - Review the Stress Test simulator and SHAP charts.
    - Check the Governance Audit Trail.
    - Click **"Generate CAM"** to receive the final professionally formatted Credit Appraisal Memo PDF.

## 🛠 Tech Stack

- **Machine Learning & AI**: Scikit-Learn (Gradient Boosting), SHAP, HuggingFace (`ProsusAI/finbert`), Google Gemini API, LangChain, FAISS (Vector DB)
- **Backend API**: Python 3.11, FastAPI, Uvicorn, PostgreSQL (with asyncpg & Alembic), ReportLab
- **Frontend App**: Next.js (App Router), React 18, TailwindCSS, Recharts, React Flow (Nodes), Zustand (State Management), Firebase Auth
- **Infra**: Context-driven REST APIs, Webhooks, Docker (Optional)
