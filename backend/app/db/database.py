"""
Database engine and SQLAlchemy setup.
Creates the async-compatible engine and registers pgvector if available.
"""
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,       # verify connections before use
    pool_size=10,
    max_overflow=20,
    echo=settings.debug,      # log SQL only in debug mode
)


# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


# ---------------------------------------------------------------------------
# pgvector extension bootstrap
# ---------------------------------------------------------------------------

def enable_pgvector(connection, branch):  # noqa: ARG001
    """Enable the pgvector extension on first connect if not already present."""
    try:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        connection.commit()
    except Exception as exc:  # noqa: BLE001
        logger.warning("pgvector_extension_skipped", reason=str(exc))


# Register the hook so it runs once per new connection
event.listen(engine, "connect", enable_pgvector)


# ---------------------------------------------------------------------------
# Database initialisation (creates all tables from metadata)
# ---------------------------------------------------------------------------

def init_db() -> None:
    """
    Create all tables defined in the ORM metadata.
    Safe to call on every startup — only creates missing tables.
    In production, prefer Alembic migrations over this function.
    """
    # Import models so metadata is populated before create_all
    from app.models.base import Base  # noqa: F401 — side-effect import
    import app.models  # noqa: F401 — registers all model classes

    logger.info("initialising_database")
    Base.metadata.create_all(bind=engine)
    logger.info("database_tables_ready")
