from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from modules.cam_generator import generate_cam_content
from utils.pdf_builder import build_cam_pdf
from routers.analyze import get_tenant
import os

router = APIRouter()

# Avoid circular imports by lazy loading the ANALYSIS_DB dictionary.
# In a real app we'd query a database.
def get_session(tenant_id, analysis_id):
    from routers.analyze import ANALYSIS_DB
    return ANALYSIS_DB.get(tenant_id, {}).get(analysis_id)


@router.get("/download/{analysis_id}")
async def download_cam_pdf(analysis_id: str, tenant: dict = Depends(get_tenant)):
    """Generate and return the CAM PDF for a given analysis."""
    session = get_session(tenant["tenant_id"], analysis_id)
    if not session or "full_result" not in session:
        # Try to load from feature store just to mock data if session lost
        from modules.feature_store import load_features
        features = load_features(analysis_id)
        if not features:
            raise HTTPException(status_code=404, detail="Analysis not found")
        raise HTTPException(status_code=500, detail="Analysis results lost from memory. Need database persistence for production.")

    full_result = session["full_result"]

    # 1. Generate text narrative for the 8 sections
    cam_sections = generate_cam_content(full_result)

    # 2. Build PDF Document
    pdf_bytes = build_cam_pdf(cam_sections, full_result)

    # 3. Return as downloadable file
    company_name = full_result.get("company_name", "Borrower").replace(" ", "_")
    filename = f"CAM_{company_name}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )
