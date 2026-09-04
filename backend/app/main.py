"""
FastAPI application entry point.
Registers all routers, middleware, exception handlers and lifecycle events.

Architecture (Section 8):
  Users → Frontend → API Layer (FastAPI) → Service Layer
       → ML/Data Layer + RAG/Knowledge/LLM Layer → Storage (PostgreSQL + pgvector)
       → Observability
"""
import time
import uuid

import structlog
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.machines import router as machines_router
from app.api.sensors import router as sensors_router
from app.api.maintenance import router as maintenance_router
from app.api.predictions import router as predictions_router
from app.api.ai import machine_router as ai_machine_router
from app.api.ai import knowledge_router
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging, get_logger

# ---------------------------------------------------------------------------
# Configure structured logging before anything else
# ---------------------------------------------------------------------------
configure_logging()
logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "AI-Based Industrial Maintenance and Process Optimization System. "
            "Combines ML anomaly detection, failure-risk prediction, "
            "RAG knowledge retrieval and LLM-generated maintenance recommendations."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # ------------------------------------------------------------------
    # CORS middleware (configure origins for your deployment)
    # ------------------------------------------------------------------
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if settings.debug else ["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ------------------------------------------------------------------
    # Request ID + observability middleware (Section 31 — Logging & Observability)
    # Tracks: request_id, user_id (from JWT sub), endpoint, latency, status code
    # ------------------------------------------------------------------
    @app.middleware("http")
    async def observability_middleware(request: Request, call_next) -> Response:
        request_id = str(uuid.uuid4())
        start_time = time.perf_counter()

        # Bind request context to all log entries within this request
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
        )

        response: Response = await call_next(request)

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        response.headers["X-Request-ID"] = request_id

        logger.info(
            "http_request",
            status_code=response.status_code,
            duration_ms=duration_ms,
        )
        return response

    # ------------------------------------------------------------------
    # Exception handlers (Section 32 — Error Handling Strategy)
    # ------------------------------------------------------------------
    register_exception_handlers(app)

    # ------------------------------------------------------------------
    # Routers — all mounted under /api prefix (Section 13)
    # ------------------------------------------------------------------
    api_prefix = settings.api_prefix  # "/api"

    app.include_router(auth_router,        prefix=api_prefix)  # /api/auth/*
    app.include_router(machines_router,    prefix=api_prefix)  # /api/machines/*
    app.include_router(sensors_router,     prefix=api_prefix)  # /api/machines/{id}/sensor-readings
    app.include_router(maintenance_router, prefix=api_prefix)  # /api/machines/{id}/maintenance
    app.include_router(predictions_router, prefix=api_prefix)  # /api/machines/{id}/predict|predictions|anomalies
    app.include_router(ai_machine_router,  prefix=api_prefix)  # /api/machines/{id}/recommendation|recommendations
    app.include_router(knowledge_router,   prefix=api_prefix)  # /api/knowledge/*

    # ------------------------------------------------------------------
    # Startup / shutdown lifecycle events
    # ------------------------------------------------------------------
    @app.on_event("startup")
    def on_startup() -> None:
        logger.info(
            "application_starting",
            name=settings.app_name,
            version=settings.app_version,
            environment=settings.environment,
            debug=settings.debug,
        )
        # Ensure all DB tables exist (safe for dev; use Alembic in production)
        if settings.environment == "development":
            try:
                from app.db.database import init_db
                init_db()
                logger.info("database_initialised")
            except Exception as exc:
                logger.warning("database_init_skipped", reason=str(exc))

        logger.info("application_ready", docs="/docs")

    @app.on_event("shutdown")
    def on_shutdown() -> None:
        logger.info("application_shutting_down")

    # ------------------------------------------------------------------
    # Health check endpoint (Section 25 — Observability)
    # ------------------------------------------------------------------
    @app.get(
        "/health",
        tags=["Health"],
        summary="Health check",
        include_in_schema=True,
    )
    def health_check() -> dict:
        """
        Returns application health status.
        Used by load balancers and container orchestrators.
        """
        return {
            "status": "healthy",
            "version": settings.app_version,
            "environment": settings.environment,
        }

    @app.get(
        "/",
        tags=["Health"],
        include_in_schema=False,
    )
    def root() -> dict:
        return {
            "message": f"Welcome to {settings.app_name}",
            "version": settings.app_version,
            "docs": "/docs",
            "health": "/health",
        }

    return app


# ---------------------------------------------------------------------------
# Application instance — used by uvicorn
# ---------------------------------------------------------------------------
app = create_app()


# ---------------------------------------------------------------------------
# Development server entry point
# Run with: python -m app.main  OR  uvicorn app.main:app --reload
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level=settings.log_level.lower(),
    )
