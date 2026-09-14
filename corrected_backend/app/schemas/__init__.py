"""Pydantic schemas package."""
from app.schemas.user import (
    UserCreate, UserUpdate, UserResponse, UserLogin, TokenResponse, TokenData
)
from app.schemas.machine import (
    MachineCreate, MachineUpdate, MachineResponse, MachineListResponse
)
from app.schemas.sensor_reading import (
    SensorReadingCreate, SensorReadingResponse, SensorReadingListResponse
)
from app.schemas.maintenance_record import (
    MaintenanceRecordCreate, MaintenanceRecordUpdate,
    MaintenanceRecordResponse, MaintenanceRecordListResponse
)
from app.schemas.prediction import (
    PredictionResponse, PredictionListResponse
)
from app.schemas.anomaly import (
    AnomalyResponse, AnomalyListResponse, AnomalyStatusUpdate
)
from app.schemas.recommendation import (
    RecommendationResponse, RecommendationListResponse,
    RecommendationStatusUpdate, RecommendationRequest
)
from app.schemas.knowledge import (
    KnowledgeSearchRequest, KnowledgeSearchResponse, KnowledgeDocumentResponse
)
from app.schemas.common import MessageResponse, PaginationParams

__all__ = [
    "UserCreate", "UserUpdate", "UserResponse", "UserLogin",
    "TokenResponse", "TokenData",
    "MachineCreate", "MachineUpdate", "MachineResponse", "MachineListResponse",
    "SensorReadingCreate", "SensorReadingResponse", "SensorReadingListResponse",
    "MaintenanceRecordCreate", "MaintenanceRecordUpdate",
    "MaintenanceRecordResponse", "MaintenanceRecordListResponse",
    "PredictionResponse", "PredictionListResponse",
    "AnomalyResponse", "AnomalyListResponse", "AnomalyStatusUpdate",
    "RecommendationResponse", "RecommendationListResponse",
    "RecommendationStatusUpdate", "RecommendationRequest",
    "KnowledgeSearchRequest", "KnowledgeSearchResponse", "KnowledgeDocumentResponse",
    "MessageResponse", "PaginationParams",
]
