"""
Predictions & Anomalies API — Section 7.5
Endpoints:
  POST /api/machines/{id}/predict       — run ML inference
  GET  /api/machines/{id}/predictions   — prediction history
  GET  /api/machines/{id}/anomalies     — anomaly history
  PATCH /api/machines/{id}/anomalies/{anomaly_id} — update anomaly status
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_maintenance_engineer_or_admin
from app.core.exceptions import NotFoundException
from app.db.session import get_db
from app.models.anomaly import Anomaly
from app.models.prediction import Prediction
from app.models.user import User
from app.schemas.anomaly import AnomalyListResponse, AnomalyResponse, AnomalyStatusUpdate
from app.schemas.prediction import PredictRequest, PredictionListResponse, PredictionResponse
from app.services.prediction_service import run_prediction

router = APIRouter(prefix="/machines", tags=["Predictions & Anomalies"])


@router.post(
    "/{machine_id}/predict",
    response_model=PredictionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Run ML inference for a machine",
)
def predict(
    machine_id: uuid.UUID,
    payload: PredictRequest | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_maintenance_engineer_or_admin),
) -> PredictionResponse:
    """
    Trigger anomaly detection + failure-risk prediction for a machine.
    Uses the latest stored sensor reading unless sensor values are provided in the body.
    """
    override = payload.model_dump(exclude_none=True) if payload else None
    prediction = run_prediction(machine_id=machine_id, db=db, override_reading=override)
    return prediction


@router.get(
    "/{machine_id}/predictions",
    response_model=PredictionListResponse,
    summary="Get prediction history for a machine",
)
def list_predictions(
    machine_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> PredictionListResponse:
    """Return paginated ML prediction history for a machine, newest first."""
    query = db.query(Prediction).filter(Prediction.machine_id == machine_id)
    total = query.count()
    items = (
        query.order_by(Prediction.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return PredictionListResponse(total=total, page=page, page_size=page_size, items=items)


@router.get(
    "/{machine_id}/anomalies",
    response_model=AnomalyListResponse,
    summary="Get anomaly history for a machine",
)
def list_anomalies(
    machine_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> AnomalyListResponse:
    """Return paginated anomaly detection history for a machine, newest first."""
    query = db.query(Anomaly).filter(Anomaly.machine_id == machine_id)
    total = query.count()
    items = (
        query.order_by(Anomaly.detected_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return AnomalyListResponse(total=total, page=page, page_size=page_size, items=items)


@router.patch(
    "/{machine_id}/anomalies/{anomaly_id}",
    response_model=AnomalyResponse,
    summary="Update anomaly status",
)
def update_anomaly_status(
    machine_id: uuid.UUID,
    anomaly_id: uuid.UUID,
    payload: AnomalyStatusUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_maintenance_engineer_or_admin),
) -> AnomalyResponse:
    """Update the status of an anomaly — e.g. acknowledge or mark as resolved."""
    anomaly = (
        db.query(Anomaly)
        .filter(Anomaly.id == anomaly_id, Anomaly.machine_id == machine_id)
        .first()
    )
    if not anomaly:
        raise NotFoundException(f"Anomaly '{anomaly_id}' not found.")
    anomaly.status = payload.status
    db.commit()
    db.refresh(anomaly)
    return anomaly
