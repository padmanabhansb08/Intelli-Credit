from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from modules.cam_generator import generate_cam_content
from utils.pdf_builder import build_cam_pdf
from routers.analyze import get_tenant
from async_database import get_async_db
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


async def get_session(db: AsyncSession, tenant_id: str, analysis_id: str):
    from sqlalchemy.future import select
    from async_models import AnalysisSession
    result = await db.execute(select(AnalysisSession).filter_by(id=analysis_id, tenant_id=tenant_id))
    session = result.scalar_one_or_none()
    return session


async def build_cam_response(analysis_id: str, tenant: dict, db: AsyncSession) -> Response:
    from modules.feature_store import load_full_analysis
    
    stored = load_full_analysis(analysis_id)
    if stored and "full_result" in stored:
        full_result = stored["full_result"]
    else:
        session = await get_session(db, tenant["tenant_id"], analysis_id)
        if not session or not session.full_result:
            raise HTTPException(status_code=404, detail="Analysis not found. Please run a new analysis.")
        full_result = session.full_result
    cam_sections = await generate_cam_content(full_result)
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
async def generate_cam_pdf(analysis_id: str, tenant: dict = Depends(get_tenant), db: AsyncSession = Depends(get_async_db)):
    """Generate a CAM PDF and return it as a downloadable blob response."""
    return await build_cam_response(analysis_id, tenant, db)


@router.get("/download/{analysis_id}")
async def download_cam_pdf(analysis_id: str, tenant: dict = Depends(get_tenant), db: AsyncSession = Depends(get_async_db)):
    """Backward-compatible download alias for the generated CAM PDF."""
    return await build_cam_response(analysis_id, tenant, db)
