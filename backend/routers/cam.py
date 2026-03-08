from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from modules.cam_generator import generate_cam_content
from utils.pdf_builder import build_cam_pdf
from routers.analyze import get_tenant

router = APIRouter()


def get_session(tenant_id, analysis_id):
    from routers.analyze import ANALYSIS_DB

    return ANALYSIS_DB.get(tenant_id, {}).get(analysis_id)


def build_cam_response(analysis_id: str, tenant: dict) -> Response:
    from modules.feature_store import load_full_analysis
    
    stored = load_full_analysis(analysis_id)
    if stored and "full_result" in stored:
        full_result = stored["full_result"]
    else:
        session = get_session(tenant["tenant_id"], analysis_id)
        if not session or "full_result" not in session:
            raise HTTPException(status_code=404, detail="Analysis not found. Please run a new analysis.")
        full_result = session["full_result"]
    cam_sections = generate_cam_content(full_result)
    pdf_bytes = build_cam_pdf(cam_sections, full_result)
    company_name = full_result.get("company_name", "Borrower").replace(" ", "_")
    filename = f"CAM_{company_name}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        },
    )


@router.post("/generate/{analysis_id}")
async def generate_cam_pdf(analysis_id: str, tenant: dict = Depends(get_tenant)):
    """Generate a CAM PDF and return it as a downloadable blob response."""
    return build_cam_response(analysis_id, tenant)


@router.get("/download/{analysis_id}")
async def download_cam_pdf(analysis_id: str, tenant: dict = Depends(get_tenant)):
    """Backward-compatible download alias for the generated CAM PDF."""
    return build_cam_response(analysis_id, tenant)
