"""
Shared FastAPI dependencies — authentication and role-based access control.
Injected via Depends() into route handlers.
"""
from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.exceptions import ForbiddenException, UnauthorizedException
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User, UserRole

_bearer = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Current user dependency
# ---------------------------------------------------------------------------

def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    """
    Decode the JWT bearer token and return the authenticated User.
    Raises UnauthorizedException for missing or invalid tokens.
    """
    if credentials is None:
        raise UnauthorizedException("No authentication token provided.")

    payload = decode_access_token(credentials.credentials)
    user_id: str | None = payload.get("sub")
    if user_id is None:
        raise UnauthorizedException("Token payload is invalid.")

    user: User | None = db.get(User, user_id)
    if user is None or not user.is_active:
        raise UnauthorizedException("User not found or account is inactive.")

    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Returns the current user if their account is active."""
    if not current_user.is_active:
        raise UnauthorizedException("Account is deactivated.")
    return current_user


# ---------------------------------------------------------------------------
# Role-gated dependencies
# ---------------------------------------------------------------------------

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Allow only ADMIN users."""
    if current_user.role != UserRole.ADMIN:
        raise ForbiddenException("Admin access required.")
    return current_user


def require_maintenance_engineer_or_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Allow ADMIN and MAINTENANCE_ENGINEER roles."""
    if current_user.role not in (UserRole.ADMIN, UserRole.MAINTENANCE_ENGINEER):
        raise ForbiddenException("Maintenance Engineer or Admin access required.")
    return current_user


def require_any_authenticated(
    current_user: User = Depends(get_current_user),
) -> User:
    """Allow any authenticated user regardless of role."""
    return current_user
