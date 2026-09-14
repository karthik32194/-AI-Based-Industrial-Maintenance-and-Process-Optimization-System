"""
Shared / reusable schema components used across the API.
"""
from pydantic import BaseModel, Field


class MessageResponse(BaseModel):
    """Generic success message response."""
    message: str


class PaginationParams(BaseModel):
    """Standard pagination query parameters."""
    page: int = Field(default=1, ge=1, description="Page number (1-indexed)")
    page_size: int = Field(default=20, ge=1, le=100, description="Items per page")

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size
