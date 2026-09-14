"""
RAG Document Loader — Section 17 (Document Loader / Text Extraction)
Supports PDF and DOCX formats. Returns raw text per document.
"""
from __future__ import annotations

from pathlib import Path

from app.core.logging import get_logger

logger = get_logger(__name__)


def load_document(file_path: str | Path) -> str:
    """
    Load and extract plain text from a document file.
    Supported formats: .pdf, .docx, .txt

    Args:
        file_path: Path to the document file.

    Returns:
        Extracted text as a single string.

    Raises:
        ValueError: If the file format is unsupported.
        FileNotFoundError: If the file does not exist.
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Document not found: {file_path}")

    suffix = path.suffix.lower()
    logger.info("loading_document", path=str(path), format=suffix)

    if suffix == ".pdf":
        return _load_pdf(path)
    if suffix == ".docx":
        return _load_docx(path)
    if suffix == ".txt":
        return path.read_text(encoding="utf-8")

    raise ValueError(f"Unsupported document format: '{suffix}'. Supported: .pdf, .docx, .txt")


def _load_pdf(path: Path) -> str:
    """Extract text from a PDF using pypdf."""
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise ImportError("pypdf is required for PDF loading. Install it with: pip install pypdf") from exc

    reader = PdfReader(str(path))
    pages: list[str] = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        pages.append(text)
        logger.debug("pdf_page_loaded", page=i + 1, chars=len(text))

    full_text = "\n".join(pages)
    logger.info("pdf_loaded", path=str(path), pages=len(pages), total_chars=len(full_text))
    return full_text


def _load_docx(path: Path) -> str:
    """Extract text from a DOCX using python-docx."""
    try:
        from docx import Document
    except ImportError as exc:
        raise ImportError(
            "python-docx is required for DOCX loading. Install it with: pip install python-docx"
        ) from exc

    doc = Document(str(path))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    full_text = "\n".join(paragraphs)
    logger.info("docx_loaded", path=str(path), paragraphs=len(paragraphs), total_chars=len(full_text))
    return full_text


def load_documents_from_directory(directory: str | Path, extensions: list[str] | None = None) -> dict[str, str]:
    """
    Load all supported documents from a directory.

    Args:
        directory: Path to scan for documents.
        extensions: List of extensions to include (default: ['.pdf', '.docx', '.txt']).

    Returns:
        Dict mapping filename -> extracted text.
    """
    extensions = extensions or [".pdf", ".docx", ".txt"]
    dir_path = Path(directory)
    results: dict[str, str] = {}

    for file_path in sorted(dir_path.iterdir()):
        if file_path.suffix.lower() in extensions:
            try:
                results[file_path.name] = load_document(file_path)
            except Exception as exc:
                logger.warning("document_load_failed", file=file_path.name, error=str(exc))

    logger.info("directory_loaded", directory=str(dir_path), documents=len(results))
    return results
