"""RAG package — loader, chunker, embeddings, retriever, pipeline."""
from app.rag.loader import load_document, load_documents_from_directory
from app.rag.chunker import chunk_text
from app.rag.embeddings import generate_embedding, generate_embeddings_batch
from app.rag.retriever import retrieve_relevant_chunks
from app.rag.pipeline import ingest_document, ingest_directory

__all__ = [
    "load_document", "load_documents_from_directory",
    "chunk_text",
    "generate_embedding", "generate_embeddings_batch",
    "retrieve_relevant_chunks",
    "ingest_document", "ingest_directory",
]
