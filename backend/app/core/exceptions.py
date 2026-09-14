"""
Domain-specific exception classes and FastAPI exception handlers.
All API error responses follow a consistent structure.
"""
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.core.logging import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Domain exceptions
# ---------------------------------------------------------------------------

class AppBaseException(Exception):
    """Base class for all application exceptions."""
    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    detail: str = "An unexpected error occurred."

    def __init__(self, detail: str | None = None):
        self.detail = detail or self.__class__.detail
        super().__init__(self.detail)


class NotFoundException(AppBaseException):
    status_code = status.HTTP_404_NOT_FOUND
    detail = "Resource not found."


class ConflictException(AppBaseException):
    status_code = status.HTTP_409_CONFLICT
    detail = "Resource already exists."


class UnauthorizedException(AppBaseException):
    status_code = status.HTTP_401_UNAUTHORIZED
    detail = "Authentication required."


class ForbiddenException(AppBaseException):
    status_code = status.HTTP_403_FORBIDDEN
    detail = "You do not have permission to perform this action."


class ValidationException(AppBaseException):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    detail = "Validation error."


class MLInferenceException(AppBaseException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    detail = "ML inference failed. Please try again."


class RAGRetrievalException(AppBaseException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    detail = "Knowledge retrieval failed. Please try again."


class LLMException(AppBaseException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    detail = "AI service unavailable. Please try again later."


# ---------------------------------------------------------------------------
# Error response helpers
# ---------------------------------------------------------------------------

def _error_response(status_code: int, detail: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": True, "detail": detail},
    )


# ---------------------------------------------------------------------------
# Exception handlers to register on the FastAPI app
# ---------------------------------------------------------------------------

def register_exception_handlers(app: FastAPI) -> None:
    """Attach all exception handlers to the FastAPI application."""

    @app.exception_handler(AppBaseException)
    async def app_exception_handler(request: Request, exc: AppBaseException):
        logger.warning(
            "application_exception",
            path=request.url.path,
            status_code=exc.status_code,
            detail=exc.detail,
        )
        return _error_response(exc.status_code, exc.detail)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        logger.warning(
            "request_validation_error",
            path=request.url.path,
            errors=exc.errors(),
        )
        return _error_response(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Request validation failed. Check your input.",
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        logger.error(
            "unhandled_exception",
            path=request.url.path,
            exc_info=exc,
        )
        # Never expose internal details to callers
        return _error_response(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "An internal server error occurred.",
        )
