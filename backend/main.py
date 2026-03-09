from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import analyze, cam, studio, applications, research, engine, execution
import os
import uvicorn

try:
    from database import init_db
except ImportError:
    init_db = None

app = FastAPI(
    title="AI Credit Decisioning Engine API",
    description="Backend API for automated credit analysis and workflow execution.",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze.router, prefix="/api", tags=["Analysis"])
app.include_router(cam.router, prefix="/api/cam", tags=["CAM Generation"])
app.include_router(applications.router, prefix="/api", tags=["Applications"])  # new
app.include_router(research.router, prefix="/api", tags=["Research"])  # new
app.include_router(engine.router, prefix="/api/v1/engine", tags=["Engine Deployment"])
app.include_router(execution.router, prefix="/api/v1/engine/execute", tags=["Engine Execution"])


@app.on_event("startup")
async def startup_event():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    for d in ["data/raw", "data/curated", "data/features", "models"]:
        os.makedirs(os.path.join(base_dir, d), exist_ok=True)
    if init_db is not None:
        init_db()


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "Credit Engine API"}


if __name__ == "__main__":
    print("Starting AI Credit Decisioning API...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

