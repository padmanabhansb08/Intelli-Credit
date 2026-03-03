from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import analyze, cam, studio
import os
import uvicorn

app = FastAPI(
    title="AI Credit Decisioning Engine API",
    description="Backend API for automated credit analysis and CAM generation.",
    version="1.0.0"
)

# CORS config to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(analyze.router, prefix="/api", tags=["Analysis"])
app.include_router(cam.router, prefix="/api/cam", tags=["CAM Generation"])
app.include_router(studio.router, prefix="/api/studio", tags=["Decision Studio Execution"])


@app.get("/health")
async def health_check():
    """Simple health check endpoint."""
    return {"status": "healthy", "service": "Credit Engine API"}


if __name__ == "__main__":
    # Ensure necessary directories exist
    base_dir = os.path.dirname(os.path.abspath(__file__))
    for d in ["data/raw", "data/curated", "data/features", "models"]:
        os.makedirs(os.path.join(base_dir, d), exist_ok=True)
        
    print("Starting AI Credit Decisioning API...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
