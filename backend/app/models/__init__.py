"""
SQLAlchemy ORM models package.
Import all models here so Alembic can discover them for migrations.
"""
from app.models.user import User
from app.models.machine import Machine
from app.models.sensor_reading import SensorReading
from app.models.maintenance_record import MaintenanceRecord
from app.models.prediction import Prediction
from app.models.anomaly import Anomaly
from app.models.recommendation import Recommendation
from app.models.knowledge import KnowledgeDocument, KnowledgeChunk

__all__ = [
    "User",
    "Machine",
    "SensorReading",
    "MaintenanceRecord",
    "Prediction",
    "Anomaly",
    "Recommendation",
    "KnowledgeDocument",
    "KnowledgeChunk",
]
