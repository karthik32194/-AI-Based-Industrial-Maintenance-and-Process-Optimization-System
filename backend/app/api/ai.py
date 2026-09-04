"""
AI & Knowledge API — Section 7.6 / Section 13 (Backend API Requirements)
Endpoints:
  POST /api/machines/{id}/recommendation  — generate AI explanation + recommendation
  GET  /api/machines/{id}/recommendations — list recommendation history
  PATCH /api/machines/{id}/recommendations/{rec_id} — update status after human review
  POST /api/knowledge/search              — semantic search against knowledge base
  GET  /api/knowledge/documents           — list ingested documents
  POST /api/knowledge/ingest              — ingest a document file (admin)
"""
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin, require_maintenance_engineer_or_admin
from app.core.config import settings
from app.core.exceptions import NotFoundException
from app.db.session import get_db
from app.models.knowledge import KnowledgeDocument
from app.models.recommendation import Recommendation
from app.models.user import User
from app.rag.pipeline import ingest_document
from app.rag.retriever import retrieve_relevant_chunks
from app.schemas.knowledge import (
    KnowledgeChunkResult,
    KnowledgeDocumentListResponse,
    KnowledgeDocumentResponse,
    KnowledgeSearchRequest,
    KnowledgeSearchResponse,
)
from app.schemas.recommendation import (
    RecommendationListResponse,
    RecommendationRequest,
    RecommendationResponse,
    RecommendationStatusUpdate,
)
from app.services.ai_service import generate_recommendation

# Two routers — one under /machines (recommendations), one under /knowledge
machine_router = APIRouter(prefix="/machines", tags=["AI & Recommendations"])
knowledge_router = APIRouter(prefix="/knowledge", tags=["Knowledge Base"])


# ---------------------------------------------------------------------------
# Recommendation endpoints
# ---------------------------------------------------------------------------

@machine_router.post(
    "/{machine_id}/recommendation",
    response_model=RecommendationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate AI explanation and maintenance recommendation",
)
def create_recommendation(
    machine_id: uuid.UUID,
    payload: RecommendationRequest | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_maintenance_engineer_or_admin),
) -> RecommendationResponse:
    """
    Combine machine context + latest ML prediction + RAG knowledge
    and call the LLM to produce an explanation and recommendation.
    Keeps AI recommendations subject to human review (Section 18 security requirement).
    """
    prediction_id = payload.prediction_id if payload else None
    additional_context = payload.additional_context if payload else None
    rec = generate_recommendation(
        machine_id=machine_id,
        db=db,
        prediction_id=prediction_id,
        additional_context=additional_context,
    )
    return rec


@machine_router.get(
    "/{machine_id}/recommendations",
    response_model=RecommendationListResponse,
    summary="Get AI recommendation history for a machine",
)
def list_recommendations(
    machine_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> RecommendationListResponse:
    """Return paginated recommendation history, newest first."""
    query = db.query(Recommendation).filter(Recommendation.machine_id == machine_id)
    total = query.count()
    items = (
        query.order_by(Recommendation.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return RecommendationListResponse(total=total, page=page, page_size=page_size, items=items)


@machine_router.patch(
    "/{machine_id}/recommendations/{rec_id}",
    response_model=RecommendationResponse,
    summary="Update recommendation status after human review",
)
def update_recommendation_status(
    machine_id: uuid.UUID,
    rec_id: uuid.UUID,
    payload: RecommendationStatusUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_maintenance_engineer_or_admin),
) -> RecommendationResponse:
    """Mark a recommendation as REVIEWED, ACTIONED, or DISMISSED after engineer review."""
    rec = (
        db.query(Recommendation)
        .filter(Recommendation.id == rec_id, Recommendation.machine_id == machine_id)
        .first()
    )
    if not rec:
        raise NotFoundException(f"Recommendation '{rec_id}' not found.")
    rec.status = payload.status
    db.commit()
    db.refresh(rec)
    return rec


# ---------------------------------------------------------------------------
# Knowledge base endpoints
# ---------------------------------------------------------------------------

@knowledge_router.post(
    "/search",
    response_model=KnowledgeSearchResponse,
    summary="Semantic search against the maintenance knowledge base",
)
def search_knowledge(
    payload: KnowledgeSearchRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> KnowledgeSearchResponse:
    """
    Perform vector similarity search against indexed maintenance documents.
    Returns top-k most relevant chunks with relevance scores.
    """
    raw_results = retrieve_relevant_chunks(
        query=payload.query,
        db=db,
        top_k=payload.top_k,
        doc_type=payload.doc_type,
    )
    results = [KnowledgeChunkResult(**r) for r in raw_results]
    return KnowledgeSearchResponse(
        query=payload.query,
        results=results,
        total_retrieved=len(results),
    )


@knowledge_router.get(
    "/documents",
    response_model=KnowledgeDocumentListResponse,
    summary="List all ingested knowledge documents",
)
def list_knowledge_documents(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> KnowledgeDocumentListResponse:
    """Return all documents that have been ingested into the knowledge base."""
    docs = db.query(KnowledgeDocument).order_by(KnowledgeDocument.ingested_at.desc()).all()
    return KnowledgeDocumentListResponse(total=len(docs), items=docs)


@knowledge_router.post(
    "/ingest",
    response_model=KnowledgeDocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest a maintenance document into the knowledge base",
)
async def ingest_knowledge_document(
    file: UploadFile = File(..., description="PDF, DOCX, or TXT document"),
    doc_type: Optional[str] = Form(default=None, description="Document type: manual, sop, troubleshooting, etc."),
    title: Optional[str] = Form(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> KnowledgeDocumentResponse:
    """
    Upload and ingest a maintenance document.
    The file is temporarily saved, processed (chunk + embed), then indexed.
    Admin only.
    """
    import tempfile, shutil

    suffix = Path(file.filename or "document").suffix.lower()
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        doc = ingest_document(
            file_path=tmp_path,
            db=db,
            doc_type=doc_type,
            title=title or file.filename,
        )
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    return doc
