"""
Pydantic schemas for RAG Knowledge Search — Section 7.6.
"""
import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class KnowledgeSearchRequest(BaseModel):
    """Payload for POST /api/knowledge/search."""
    query: str = Field(..., min_length=3, max_length=1000)
    top_k: int = Field(default=5, ge=1, le=20)
    doc_type: Optional[str] = None   # filter by document type (e.g. "sop", "manual")


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class KnowledgeChunkResult(BaseModel):
    """A single retrieved knowledge chunk with relevance score."""
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_filename: str
    content: str
    relevance_score: float
    source_page: Optional[int]

    model_config = {"from_attributes": True}


class KnowledgeSearchResponse(BaseModel):
    """Response for semantic knowledge search."""
    query: str
    results: List[KnowledgeChunkResult]
    total_retrieved: int


class KnowledgeDocumentResponse(BaseModel):
    """Metadata about an ingested knowledge document."""
    id: uuid.UUID
    filename: str
    title: Optional[str]
    doc_type: Optional[str]
    total_chunks: int
    ingested_at: datetime

    model_config = {"from_attributes": True}


class KnowledgeDocumentListResponse(BaseModel):
    """List of all ingested knowledge documents."""
    total: int
    items: List[KnowledgeDocumentResponse]
