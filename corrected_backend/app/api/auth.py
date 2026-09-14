"""
Authentication API — Section 7.1
Endpoints:
  POST /api/auth/register  — user registration
  POST /api/auth/login     — login, returns JWT
  GET  /api/auth/me        — current user identity
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.exceptions import ConflictException, UnauthorizedException
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import TokenResponse, UserCreate, UserLogin, UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> UserResponse:
    """
    Create a new user account.
    - Email must be unique.
    - Password is hashed with bcrypt before storage — plaintext is never persisted.
    """
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise ConflictException(f"Email '{payload.email}' is already registered.")

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login and obtain a JWT access token",
)
def login(payload: UserLogin, db: Session = Depends(get_db)) -> TokenResponse:
    """
    Authenticate with email + password.
    Returns a signed JWT access token and the current user profile.
    """
    user: User | None = db.query(User).filter(User.email == payload.email).first()

    if user is None or not verify_password(payload.password, user.password_hash):
        raise UnauthorizedException("Invalid email or password.")

    if not user.is_active:
        raise UnauthorizedException("This account has been deactivated.")

    token = create_access_token(
        subject=str(user.id),
        extra_claims={"role": user.role.value},
    )
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get the currently authenticated user",
)
def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    """Return the identity and role of the currently authenticated user."""
    return current_user
