"""
Machine Service — Section 15
Business logic for machine management, separated from API layer.
"""
from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictException, NotFoundException
from app.core.logging import get_logger
from app.models.machine import Machine, MachineStatus
from app.models.prediction import Prediction
from app.models.anomaly import Anomaly
from app.schemas.machine import MachineCreate, MachineUpdate

logger = get_logger(__name__)


def create_machine(payload: MachineCreate, db: Session) -> Machine:
    machine = Machine(**payload.model_dump())
    db.add(machine)
    db.commit()
    db.refresh(machine)
    logger.info("machine_created", machine_id=str(machine.id), name=machine.machine_name)
    return machine


def get_machine_or_404(machine_id: uuid.UUID, db: Session) -> Machine:
    machine = db.get(Machine, machine_id)
    if not machine:
        raise NotFoundException(f"Machine '{machine_id}' not found.")
    return machine


def update_machine(machine_id: uuid.UUID, payload: MachineUpdate, db: Session) -> Machine:
    machine = get_machine_or_404(machine_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(machine, field, value)
    db.commit()
    db.refresh(machine)
    logger.info("machine_updated", machine_id=str(machine_id))
    return machine


def deactivate_machine(machine_id: uuid.UUID, db: Session) -> None:
    machine = get_machine_or_404(machine_id, db)
    machine.status = MachineStatus.DECOMMISSIONED
    db.commit()
    logger.info("machine_deactivated", machine_id=str(machine_id))


def get_machine_summary(machine_id: uuid.UUID, db: Session) -> dict:
    """
    Return a summary dict with machine details + latest prediction + open anomaly count.
    Used for the dashboard view.
    """
    machine = get_machine_or_404(machine_id, db)
    latest_prediction: Optional[Prediction] = (
        db.query(Prediction)
        .filter(Prediction.machine_id == machine_id)
        .order_by(Prediction.created_at.desc())
        .first()
    )
    open_anomalies = (
        db.query(Anomaly)
        .filter(Anomaly.machine_id == machine_id, Anomaly.status == "OPEN")
        .count()
    )
    return {
        "machine": machine,
        "latest_prediction": latest_prediction,
        "open_anomaly_count": open_anomalies,
    }
