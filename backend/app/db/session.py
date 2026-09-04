"""
FastAPI dependency for database session injection.

Usage in route handlers:
    from app.db.session import get_db
    from sqlalchemy.orm import Session
    from fastapi import Depends

    @router.get("/example")
    def example(db: Session = Depends(get_db)):
        ...
"""
from collections.abc import Generator

from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.core.logging import get_logger

logger = get_logger(__name__)


def get_db() -> Generator[Session, None, None]:
    """
    Yield a SQLAlchemy Session, then close it after the request completes.
    Rolls back on unhandled exceptions to prevent partial commits.
    """
    db: Session = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
