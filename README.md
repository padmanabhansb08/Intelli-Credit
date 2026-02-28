# NexCredit AI - Intelligent Corporate Underwriting

> An autonomous AI Credit Officer designed to simulate how Tier-1 bank credit committees operate.

NexCredit AI ingests structured and unstructured borrower financial data, conducts autonomous web-scale due diligence, computes an explainable composite risk score using Machine Learning ensembles, simulates stress tests, evaluating RAROC capital impact, and automatically generates a structured, downloadable Credit Appraisal Memo (CAM) in PDF format.

## 🔥 Key Hackathon Differentiators

1.  **"AI Credit Officer" Persona**: The system is not just an ML pipeline; it acts as an autonomous underwriter with a unified dashboard.
2.  **Web-Scale Web Research Simulation**: Includes NLP sentiment analysis, ESG scores, and litigation checks.
3.  **Capital Impact (RAROC) Simulation**: Elevates from basic scoring to bank portfolio management by assessing Risk-Weighted Assets (RWA) and capital requirements.
4.  **SHAP-Based Explainability**: Avoids "black box" models. The top 5 contributing risk drivers are extracted for every decision.
5.  **Responsible AI Metrics**: Includes automated fairness evaluation (Disparate Impact Ratio) across demographics built directly into the model training pipeline.

## 🏗 System Architecture

The project consists of a Python FastAPI backend acting as the Machine Learning and Agent orchestration layer, paired with a modern React/Next.js frontend.

```mermaid
graph TD;
    A[Frontend Dashboard (Next.js)] <-->|REST API| B(FastAPI Backend);
    B --> C(PDF/CSV Data Ingestion Engine);
    B --> D{Feature Store};
    B --> E((ML Inference Engine));
    B --> F((Web-Scale Research Simulator));
    B --> G[(Risk Synthesis & Capital Impact)];
    E --> H[PD Model (Gradient Boosting)];
    E --> I[Limit Model (GB Regression)];
    E --> SHAP[SHAP TreeExplainer];
    G --> J(Decision Logic Rules Engine);
    J --> K[LLM-Style CAM Text Generator];
    K --> L[ReportLab PDF Builder];
    L --> A;
```

## 🚀 Quick Start (Docker)

Ensure you have Docker and Docker Compose installed.

1.  Clone this repository.
2.  Run the application:
    ```bash
    docker-compose up --build
    ```
    *Note: During the first build, the backend Docker container will automatically generate a highly realistic synthetic dataset of 2,000 corporate borrowers, train the Scikit-Learn Gradient Boosting models, and generate the bias/fairness reports.*

3.  Access the platform:
    - **Frontend UI**: `http://localhost:3000`
    - **Backend API Docs**: `http://localhost:8000/docs`

## 🧠 Using the Demo

1.  Open the Dashboard at `http://localhost:3000`.
2.  **Upload a PDF**: You can upload any sample PDF. The system includes regex extraction and OCR fallback (simulated for immediate demo flow).
3.  **Configure**: Enter a Company Name, select an Industry, and input the loan amount requested.
4.  **Analyze**: Click "Run Autonomous Analysis". The UI will animate through the cognitive steps of the AI Credit Officer.
5.  **Review the Output**:
    - Observe the final decision (APPROVE / CONDITIONAL / REJECT).
    - Review the Stress Test simulator.
    - Check the Governance Audit Trail.
    - **Click "Download CAM PDF"** to get the final, 8-section professionally formatted Credit Appraisal Memo.

## 🛠 Tech Stack

- **Machine Learning**: Scikit-Learn (GradientBoostingClassifier, GradientBoostingRegressor), SHAP, Numpy, Pandas
- **Backend API**: Python 3.11, FastAPI, Uvicorn, ReportLab (PDF generation), pdfplumber
- **Frontend App**: Next.js 15 (App Router), React 18, TailwindCSS 4, Recharts, Lucide-React
- **Infra**: Docker, Docker Compose
