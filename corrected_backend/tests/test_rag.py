"""
Unit tests for RAG pipeline — Section 17
Tests: chunking, text cleaning, embedding fallback, document loading.
"""
import pytest

from app.rag.chunker import chunk_text, _clean_text, _estimate_tokens
from app.rag.embeddings import _zero_embedding


def test_chunk_text_basic():
    text = "This is a test document. " * 100
    chunks = chunk_text(text, chunk_size=200, chunk_overlap=20)
    assert len(chunks) > 1
    for chunk in chunks:
        assert "content" in chunk
        assert "chunk_index" in chunk
        assert len(chunk["content"]) > 0


def test_chunk_text_empty():
    chunks = chunk_text("", chunk_size=200, chunk_overlap=20)
    assert chunks == []


def test_chunk_text_short():
    text = "Short document."
    chunks = chunk_text(text, chunk_size=512, chunk_overlap=64)
    assert len(chunks) == 1
    assert chunks[0]["content"] == "Short document."


def test_chunk_indices_sequential():
    text = "Word " * 500
    chunks = chunk_text(text, chunk_size=100, chunk_overlap=10)
    for i, chunk in enumerate(chunks):
        assert chunk["chunk_index"] == i


def test_clean_text_normalises_whitespace():
    dirty = "Line1\r\nLine2\n\n\n\nLine3    extra"
    clean = _clean_text(dirty)
    assert "\r\n" not in clean
    assert "\n\n\n" not in clean


def test_estimate_tokens():
    text = "a" * 400
    tokens = _estimate_tokens(text)
    assert tokens == 100  # 400 / 4


def test_zero_embedding_length():
    emb = _zero_embedding(1536)
    assert len(emb) == 1536
    assert all(v == 0.0 for v in emb)


def test_zero_embedding_default():
    emb = _zero_embedding()
    assert len(emb) == 1536
