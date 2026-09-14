"""
RAG Ingestion Pipeline — Section 17
Orchestrates: load → chunk → embed → store vectors in PostgreSQL.
"""
from __future__ import annotations

import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.knowledge import KnowledgeChunk, KnowledgeDocument
from app.rag.chunker import chunk_text
from app.rag.embeddings import generate_embeddings_batch
from app.rag.loader import load_document

logger = get_logger(__name__)


def ingest_document(
    file_path: str | Path,
    db: Session,
    doc_type: str | None = None,
    title: str | None = None,
) -> KnowledgeDocument:
    """
    Full RAG ingestion pipeline for a single document.

    Steps:
    1. Load and extract text.
    2. Clean and chunk text.
    3. Generate embeddings for all chunks (batched).
    4. Persist KnowledgeDocument + KnowledgeChunk records.

    Args:
        file_path: Path to the document file.
        db:        SQLAlchemy session.
        doc_type:  Optional document category (e.g. 'manual', 'sop').
        title:     Optional human-readable title.

    Returns:
        Persisted KnowledgeDocument ORM object.
    """
    path = Path(file_path)
    logger.info("rag_ingestion_start", file=path.name)

    # 1. Load text
    raw_text = load_document(path)
    if not raw_text.strip():
        raise ValueError(f"Document '{path.name}' yielded no extractable text.")

    # 2. Chunk
    chunks_data = chunk_text(raw_text)
    if not chunks_data:
        raise ValueError(f"Document '{path.name}' produced no text chunks.")

    logger.info("document_chunked", file=path.name, chunks=len(chunks_data))

    # 3. Generate embeddings (batched for efficiency)
    texts = [c["content"] for c in chunks_data]
    embeddings = generate_embeddings_batch(texts)

    # 4. Persist
    doc = KnowledgeDocument(
        filename=path.name,
        title=title or path.stem.replace("_", " ").title(),
        doc_type=doc_type,
        total_chunks=len(chunks_data),
        source_path=str(path.resolve()),
    )
    db.add(doc)
    db.flush()  # get doc.id before inserting chunks

    for chunk_data, embedding in zip(chunks_data, embeddings):
        chunk = KnowledgeChunk(
            document_id=doc.id,
            chunk_index=chunk_data["chunk_index"],
            content=chunk_data["content"],
            token_count=chunk_data.get("token_count"),
            embedding=embedding if any(v != 0.0 for v in embedding) else None,
        )
        db.add(chunk)

    db.commit()
    db.refresh(doc)

    logger.info(
        "rag_ingestion_complete",
        file=path.name,
        doc_id=str(doc.id),
        chunks=doc.total_chunks,
    )
    return doc


def ingest_directory(
    directory: str | Path,
    db: Session,
    doc_type_map: dict[str, str] | None = None,
) -> list[KnowledgeDocument]:
    """
    Ingest all supported documents from a directory.

    Args:
        directory:    Directory path to scan.
        db:           SQLAlchemy session.
        doc_type_map: Optional filename -> doc_type mapping for categorisation.

    Returns:
        List of successfully ingested KnowledgeDocument objects.
    """
    dir_path = Path(directory)
    extensions = {".pdf", ".docx", ".txt"}
    ingested: list[KnowledgeDocument] = []

    for file_path in sorted(dir_path.iterdir()):
        if file_path.suffix.lower() not in extensions:
            continue
        doc_type = (doc_type_map or {}).get(file_path.name)
        try:
            doc = ingest_document(file_path, db, doc_type=doc_type)
            ingested.append(doc)
        except Exception as exc:
            logger.warning("document_ingestion_failed", file=file_path.name, error=str(exc))

    logger.info("directory_ingestion_complete", directory=str(dir_path), ingested=len(ingested))
    return ingested
