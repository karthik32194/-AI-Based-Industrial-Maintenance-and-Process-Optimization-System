"""
RAG Retriever — Section 17 (Semantic Search / Vector Search)
Performs cosine-similarity search against stored embeddings using pgvector.
Falls back to keyword search when pgvector is unavailable.
"""
from __future__ import annotations

import uuid

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import RAGRetrievalException
from app.core.logging import get_logger
from app.models.knowledge import KnowledgeChunk, KnowledgeDocument
from app.rag.embeddings import generate_embedding

logger = get_logger(__name__)


def retrieve_relevant_chunks(
    query: str,
    db: Session,
    top_k: int | None = None,
    doc_type: str | None = None,
) -> list[dict]:
    """
    Perform semantic search against the knowledge base.

    Args:
        query:    Natural language query string.
        db:       SQLAlchemy session.
        top_k:    Number of results to return (default from settings).
        doc_type: Optional filter by document type (e.g. 'sop', 'manual').

    Returns:
        List of result dicts with keys:
          chunk_id, document_id, document_filename, content, relevance_score, source_page
    """
    top_k = top_k or settings.rag_top_k
    logger.info("rag_retrieval_start", query=query[:80], top_k=top_k)

    # Generate query embedding
    try:
        query_embedding = generate_embedding(query)
    except Exception as exc:
        logger.error("query_embedding_failed", error=str(exc))
        raise RAGRetrievalException(f"Failed to embed query: {exc}") from exc

    # Try pgvector cosine similarity search
    try:
        results = _pgvector_search(query_embedding, db, top_k, doc_type)
        logger.info("rag_retrieval_complete", results=len(results), method="pgvector")
        return results
    except Exception as exc:
        logger.warning("pgvector_search_failed_fallback", error=str(exc))

    # Fallback: keyword search
    results = _keyword_search(query, db, top_k, doc_type)
    logger.info("rag_retrieval_complete", results=len(results), method="keyword_fallback")
    return results


def _pgvector_search(
    query_embedding: list[float],
    db: Session,
    top_k: int,
    doc_type: str | None,
) -> list[dict]:
    """Use pgvector <=> (cosine distance) operator for semantic search."""
    embedding_str = "[" + ",".join(str(v) for v in query_embedding) + "]"

    # Build query with optional doc_type filter
    join_filter = ""
    if doc_type:
        join_filter = f"AND kd.doc_type = '{doc_type}'"

    sql = text(f"""
        SELECT
            kc.id            AS chunk_id,
            kc.document_id,
            kd.filename      AS document_filename,
            kc.content,
            kc.source_page,
            1 - (kc.embedding <=> :embedding::vector) AS relevance_score
        FROM knowledge_chunks kc
        JOIN knowledge_documents kd ON kd.id = kc.document_id
        WHERE kc.embedding IS NOT NULL
        {join_filter}
        ORDER BY kc.embedding <=> :embedding::vector
        LIMIT :top_k
    """)

    rows = db.execute(sql, {"embedding": embedding_str, "top_k": top_k}).fetchall()
    return [
        {
            "chunk_id": row.chunk_id,
            "document_id": row.document_id,
            "document_filename": row.document_filename,
            "content": row.content,
            "relevance_score": float(row.relevance_score),
            "source_page": row.source_page,
        }
        for row in rows
    ]


def _keyword_search(
    query: str,
    db: Session,
    top_k: int,
    doc_type: str | None,
) -> list[dict]:
    """Simple keyword (ILIKE) fallback search when pgvector is not available."""
    q = (
        db.query(KnowledgeChunk, KnowledgeDocument)
        .join(KnowledgeDocument, KnowledgeChunk.document_id == KnowledgeDocument.id)
    )
    if doc_type:
        q = q.filter(KnowledgeDocument.doc_type == doc_type)

    # Search for any word in the query
    words = [w for w in query.split() if len(w) > 3][:5]
    for word in words:
        q = q.filter(KnowledgeChunk.content.ilike(f"%{word}%"))

    rows = q.limit(top_k).all()
    return [
        {
            "chunk_id": chunk.id,
            "document_id": chunk.document_id,
            "document_filename": doc.filename,
            "content": chunk.content,
            "relevance_score": 0.5,  # no true score in keyword mode
            "source_page": chunk.source_page,
        }
        for chunk, doc in rows
    ]
