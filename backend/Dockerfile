# ============================================================
# AI Maintenance & Optimization System — Backend Dockerfile
# Multi-stage build: builder installs deps, final image is lean
# ============================================================

# ---- Stage 1: dependency builder ----
FROM python:3.11-slim AS builder

WORKDIR /build

# Install uv (fast Python package manager as per tech stack)
RUN pip install --no-cache-dir uv==0.4.10

# Copy dependency manifest
COPY pyproject.toml .

# Install all runtime dependencies into a dedicated prefix
RUN uv pip install --system --no-cache \
    fastapi==0.111.0 \
    uvicorn[standard]==0.30.1 \
    pydantic==2.7.4 \
    pydantic-settings==2.3.4 \
    email-validator==2.2.0 \
    sqlalchemy==2.0.31 \
    alembic==1.13.2 \
    psycopg2-binary==2.9.9 \
    pgvector==0.3.2 \
    python-jose[cryptography]==3.3.0 \
    passlib[bcrypt]==1.7.4 \
    python-multipart==0.0.9 \
    bcrypt==4.1.3 \
    pandas==2.2.2 \
    numpy==1.26.4 \
    scikit-learn==1.5.1 \
    joblib==1.4.2 \
    openai==1.35.13 \
    langchain==0.2.6 \
    langchain-openai==0.1.14 \
    langchain-community==0.2.6 \
    tiktoken==0.7.0 \
    pypdf==4.2.0 \
    python-docx==1.1.2 \
    structlog==24.2.0 \
    python-json-logger==2.0.7 \
    python-dotenv==1.0.1 \
    httpx==0.27.0 \
    tenacity==8.4.2

# ---- Stage 2: final runtime image ----
FROM python:3.11-slim AS runtime

# Security: run as non-root user
RUN groupadd --gid 1001 appgroup \
 && useradd --uid 1001 --gid appgroup --shell /bin/bash --create-home appuser

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11 /usr/local/lib/python3.11
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application source
COPY --chown=appuser:appgroup . .

# Create directories for ML models and knowledge documents
RUN mkdir -p /app/models /app/data/knowledge \
 && chown -R appuser:appgroup /app/models /app/data/knowledge

USER appuser

# Expose FastAPI default port
EXPOSE 8000

# Health check — hits the /health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

# Default command: run uvicorn
# Override with CMD in docker-compose for dev (--reload) vs prod
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
