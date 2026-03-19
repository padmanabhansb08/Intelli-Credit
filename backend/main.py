import sys
print("BACKEND: Starting main.py...")
from unittest.mock import MagicMock
print("BACKEND: MagicMock imported")

# Simple Global Mocks for missing heavy dependencies to unblock server startup
MOCK_LIST = [
    "numpy", "pandas", "pdf2image", "pdfplumber", "pytesseract", "scipy", "scipy.stats", 
    "joblib", "xgboost", "shap", "firebase_admin", "firebase_admin.auth", 
    "firebase_admin.credentials", "firebase_admin.storage", "reportlab", "reportlab.lib", 
    "reportlab.platypus", "reportlab.lib.pagesizes", "reportlab.lib.styles", "reportlab.lib.units",
    "reportlab.lib.enums", "reportlab.lib.colors", "reportlab.graphics", "reportlab.graphics.shapes",
    "google", "google.generativeai", "langchain", "langchain_openai", "langchain_community",
    "langchain.prompts", "langchain.schema", "langchain.chains", "tavily",
    "sqlalchemy", "sqlalchemy.orm", "sqlalchemy.types", "sqlalchemy.engine", "sqlalchemy.sql"
]

import importlib

for mod_name in MOCK_LIST:
    try:
        importlib.import_module(mod_name)
    except Exception:
        if mod_name not in sys.modules:
            m = MagicMock()
            m._apps = [] # for firebase_admin
            sys.modules[mod_name] = m
            print(f"DEBUG: Mocked {mod_name}")

print("BACKEND: Dependency check completed")
from fastapi import FastAPI
print("BACKEND: FastAPI imported")
from fastapi.middleware.cors import CORSMiddleware
print("BACKEND: CORSMiddleware imported")
import uvicorn
print("BACKEND: uvicorn imported")

# --- Individual Router Imports ---
try:
    print("BACKEND: Importing database...")
    import database
    print("BACKEND: database imported")
except Exception as e:
    print(f"WARNING: database import failed: {e}")

try:
    import db_models
    print("BACKEND: db_models imported")
except Exception as e:
    print(f"WARNING: db_models import failed: {e}")

def load_router(mod_path, alias=None):
    try:
        print(f"BACKEND: Importing {mod_path}...")
        mod = importlib.import_module(mod_path)
        print(f"BACKEND: {mod_path} imported")
        return mod
    except Exception as e:
        print(f"WARNING: Failed to import {mod_path}: {e}")
        return None

approvals_router = load_router("routers.approvals")
decision_studio_core = load_router("routers.decision_studio_core")
applications = load_router("routers.applications")
analyze_router = load_router("routers.analyze")
cam_router = load_router("routers.cam")
portfolio_router = load_router("routers.portfolio")
research_router = load_router("routers.research")

# MiroFish simulation router
simulation_router = load_router("routers.simulation")

app = FastAPI(title="AI Credit Decisioning Engine API (Rescue Mode)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if approvals_router:
    app.include_router(approvals_router.router, prefix="/api/v2", tags=["Policy Approvals"])
if decision_studio_core:
    app.include_router(decision_studio_core.router, prefix="/api/decision-studio", tags=["Decision Studio"])
if applications:
    app.include_router(applications.router, prefix="/api", tags=["Applications"])
if analyze_router:
    app.include_router(analyze_router.router, prefix="/api", tags=["Analysis Engine"])
if cam_router:
    app.include_router(cam_router.router, prefix="/api/cam", tags=["CAM Generation"])
if portfolio_router:
    app.include_router(portfolio_router.router, prefix="/api/portfolio", tags=["Portfolio Management"])
if research_router:
    app.include_router(research_router.router, prefix="/api/research", tags=["Web Research"])
if simulation_router:
    app.include_router(simulation_router.router, tags=["MiroFish Simulation"])

@app.get("/health")
def health():
    return {
        "status": "ok", 
        "mode": "rescue", 
        "routers_loaded": {
            "approvals": approvals_router is not None,
            "decision_studio": decision_studio_core is not None,
            "applications": applications is not None,
            "simulation": simulation_router is not None
        }
    }

@app.get("/api/health")
def api_health():
    return {"status": "ok", "mode": "rescue_api"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8006)
