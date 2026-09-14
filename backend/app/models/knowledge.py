"""
Knowledge models — maintenance document storage and vector chunks for RAG.
Tables: knowledge_documents, knowledge_chunks  (Section 17 / Section 11 recommended tables)
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin

# pgvector import — the vector type is used for embedding storage
try:
    from pgvector.sqlalchemy import Vector
    _VECTOR_AVAILABLE = True
except ImportError:
    _VECTOR_AVAILABLE = False
    Vector = None


class KnowledgeDocument(Base, UUIDMixin):
    """
    Represents an ingested maintenance document (manual, SOP, troubleshooting guide).
    """
    __tablename__ = "knowledge_documents"

    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    doc_type: Mapped[str | None] = mapped_column(String(80), nullable=True)   # e.g. "manual", "sop"
    total_chunks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    source_path: Mapped[str | None] = mapped_column(String(512), nullable=True)

    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    chunks = relationship(
        "KnowledgeChunk", back_populates="document",
        cascade="all, delete-orphan", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<KnowledgeDocument id={self.id} filename={self.filename}>"


def _build_chunk_columns():
    """
    Dynamically define the embedding column depending on whether pgvector is available.
    When pgvector is absent (e.g., local dev without the extension), we fall back to Text.
    """
    if _VECTOR_AVAILABLE and Vector is not None:
        return mapped_column(Vector(1536), nullable=True)
    return mapped_column(Text, nullable=True)


class KnowledgeChunk(Base, UUIDMixin):
    """
    One text chunk from a knowledge document, with its embedding vector.
    The embedding column uses pgvector's Vector type for semantic search.
    """
    __tablename__ = "knowledge_chunks"

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("knowledge_documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding = _build_chunk_columns()

    # Metadata for retrieval quality
    token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_page: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    document = relationship("KnowledgeDocument", back_populates="chunks")

    def __repr__(self) -> str:
        return (
            f"<KnowledgeChunk id={self.id} doc={self.document_id} idx={self.chunk_index}>"
        )
