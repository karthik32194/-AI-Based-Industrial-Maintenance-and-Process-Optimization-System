"""
RAG Embeddings — Section 17 (Embeddings)
Generates text embeddings using the OpenAI embeddings API.
Includes batching and retry logic.
"""
from __future__ import annotations

import time
from typing import Optional

from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.core.exceptions import RAGRetrievalException
from app.core.logging import get_logger

logger = get_logger(__name__)

# Lazy OpenAI client — created on first use to avoid import errors
# when OPENAI_API_KEY is not configured
_openai_client = None


def _get_client():
    global _openai_client
    if _openai_client is None:
        try:
            from openai import OpenAI
            _openai_client = OpenAI(api_key=settings.openai_api_key)
        except ImportError as exc:
            raise ImportError("openai package is required. Install with: pip install openai") from exc
    return _openai_client


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    reraise=True,
)
def generate_embedding(text: str) -> list[float]:
    """
    Generate a single embedding vector for the given text.

    Args:
        text: Input text to embed (max ~8192 tokens for text-embedding-3-small).

    Returns:
        List of floats representing the embedding vector.
    """
    if not settings.openai_api_key:
        logger.warning("openai_api_key_missing_returning_zeros")
        return _zero_embedding()

    client = _get_client()
    try:
        response = client.embeddings.create(
            model=settings.openai_embedding_model,
            input=text.strip(),
        )
        vector = response.data[0].embedding
        logger.debug("embedding_generated", model=settings.openai_embedding_model, dims=len(vector))
        return vector
    except Exception as exc:
        logger.error("embedding_generation_failed", error=str(exc))
        raise RAGRetrievalException(f"Embedding generation failed: {exc}") from exc


def generate_embeddings_batch(
    texts: list[str],
    batch_size: int = 100,
) -> list[list[float]]:
    """
    Generate embeddings for a list of texts in batches.

    Args:
        texts:      List of text strings to embed.
        batch_size: Number of texts per API call (OpenAI max is 2048 inputs).

    Returns:
        List of embedding vectors in the same order as input texts.
    """
    if not texts:
        return []

    if not settings.openai_api_key:
        logger.warning("openai_api_key_missing_returning_zeros_batch")
        return [_zero_embedding() for _ in texts]

    client = _get_client()
    all_embeddings: list[list[float]] = []

    for i in range(0, len(texts), batch_size):
        batch = [t.strip() for t in texts[i: i + batch_size]]
        try:
            response = client.embeddings.create(
                model=settings.openai_embedding_model,
                input=batch,
            )
            batch_embeddings = [item.embedding for item in sorted(response.data, key=lambda x: x.index)]
            all_embeddings.extend(batch_embeddings)
            logger.info(
                "embeddings_batch_generated",
                batch=i // batch_size + 1,
                count=len(batch),
            )
        except Exception as exc:
            logger.error("embeddings_batch_failed", batch_start=i, error=str(exc))
            raise RAGRetrievalException(f"Batch embedding failed: {exc}") from exc

    return all_embeddings


def _zero_embedding(dims: int = 1536) -> list[float]:
    """Return a zero vector of the specified dimension (used as fallback)."""
    return [0.0] * dims
