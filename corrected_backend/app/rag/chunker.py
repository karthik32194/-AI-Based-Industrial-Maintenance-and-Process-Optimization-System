"""
RAG Text Chunker — Section 17 (Chunking)
Splits document text into overlapping chunks for embedding.
"""
from __future__ import annotations

import re

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def chunk_text(
    text: str,
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> list[dict]:
    """
    Split text into overlapping chunks by character count.

    Args:
        text:         Input document text.
        chunk_size:   Maximum characters per chunk (default from settings).
        chunk_overlap: Number of characters to overlap between chunks (default from settings).

    Returns:
        List of dicts: [{"chunk_index": int, "content": str, "token_count": int}]
    """
    chunk_size = chunk_size or settings.rag_chunk_size
    chunk_overlap = chunk_overlap or settings.rag_chunk_overlap

    # Normalise whitespace
    text = _clean_text(text)

    if not text.strip():
        return []

    chunks: list[dict] = []
    start = 0
    idx = 0

    while start < len(text):
        end = start + chunk_size
        chunk_content = text[start:end].strip()

        if chunk_content:
            chunks.append({
                "chunk_index": idx,
                "content": chunk_content,
                "token_count": _estimate_tokens(chunk_content),
            })
            idx += 1

        # Advance with overlap — prefer sentence boundary
        next_start = end - chunk_overlap
        boundary = _find_sentence_boundary(text, next_start, window=100)
        start = boundary if boundary > start else next_start
        if start >= len(text):
            break

    logger.info("text_chunked", total_chunks=len(chunks), chunk_size=chunk_size)
    return chunks


def _clean_text(text: str) -> str:
    """Remove excessive whitespace and normalise line endings."""
    text = re.sub(r"\r\n|\r", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()


def _find_sentence_boundary(text: str, pos: int, window: int = 100) -> int:
    """
    Look forward from pos up to window characters for a sentence boundary ('. ', '! ', '? ').
    Returns pos if no boundary found.
    """
    search_end = min(pos + window, len(text))
    segment = text[pos:search_end]
    for pattern in (". ", "! ", "? ", "\n\n"):
        idx = segment.find(pattern)
        if idx != -1:
            return pos + idx + len(pattern)
    return pos


def _estimate_tokens(text: str) -> int:
    """
    Rough token count estimate: ~4 characters per token (OpenAI GPT tokenisation average).
    """
    return max(1, len(text) // 4)
