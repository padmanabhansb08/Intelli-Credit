from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from routers import analyze, cam, studio, applications, research
import os
import uvicorn

from security.auth import verify_firebase_token

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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze.router, prefix="/api", tags=["Analysis"])
app.include_router(cam.router, prefix="/api/cam", tags=["CAM Generation"])
app.include_router(applications.router, prefix="/api", tags=["Applications"])  # new
app.include_router(research.router, prefix="/api", tags=["Research"])  # new


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

@app.get("/api/secure-data", dependencies=[Depends(verify_firebase_token)])
async def secure_endpoint():
    """Example of a route protected by Firebase Authentication."""
    return {"message": "You are securely authenticated via Firebase!"}


if __name__ == "__main__":
    print("Starting AI Credit Decisioning API...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

