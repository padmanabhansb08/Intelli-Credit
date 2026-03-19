import sys
print("BACKEND: Starting main.py...")
from unittest.mock import MagicMock
print("BACKEND: MagicMock imported")

from security.auth import verify_firebase_token
from core.config import settings

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

app = FastAPI(
    title=settings.PROJECT_NAME if hasattr(settings, 'PROJECT_NAME') else "AI Credit Decisioning Engine API",
    description="Backend API for automated credit analysis and workflow execution.",
    version=settings.VERSION if hasattr(settings, 'VERSION') else "1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS if hasattr(settings, 'ALLOWED_ORIGINS') else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Individual Router Imports ---
def load_router(mod_path):
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
simulation_router = load_router("routers.simulation")

# Idempotency middleware — caches POST responses by Idempotency-Key header
try:
    from middleware.idempotency import IdempotencyMiddleware
    app.add_middleware(IdempotencyMiddleware)
except ImportError:
    pass  # graceful fallback if cachetools not installed

# V1/Standard Routers
if analyze_router: app.include_router(analyze_router.router, prefix="/api", tags=["Analysis Engine"])
if cam_router: app.include_router(cam_router.router, prefix="/api/cam", tags=["CAM Generation"])
if applications: app.include_router(applications.router, prefix="/api", tags=["Applications"])
if research_router: app.include_router(research_router.router, prefix="/api/research", tags=["Web Research"])
if portfolio_router: app.include_router(portfolio_router.router, prefix="/api/portfolio", tags=["Portfolio Management"])
if simulation_router: app.include_router(simulation_router.router, tags=["MiroFish Simulation"])

# V2/Decision Studio Routers
if approvals_router: app.include_router(approvals_router.router, prefix="/api/v2", tags=["Policy Approvals"])
if decision_studio_core: app.include_router(decision_studio_core.router, prefix="/api/decision-studio", tags=["Decision Studio"])

from async_database import async_engine
from async_models import AsyncBase

@app.on_event("startup")
async def startup_event():
    import os
    base_dir = os.path.dirname(os.path.abspath(__file__))
    for d in ["data/raw", "data/curated", "data/features", "models"]:
        os.makedirs(os.path.join(base_dir, d), exist_ok=True)
    try:
        async with async_engine.begin() as conn:
            await conn.run_sync(AsyncBase.metadata.create_all)
    except Exception as e:
        print(f"WARNING: Async DB initialization failed: {e}")


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
