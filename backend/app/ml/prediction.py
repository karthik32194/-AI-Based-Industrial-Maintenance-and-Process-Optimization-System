"""
Failure-risk prediction — Section 16 (predict_failure, calculate_machine_health)
Uses a Random Forest classifier to predict failure probability and risk level.
"""
from __future__ import annotations

import pickle
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder

from app.core.config import settings
from app.core.logging import get_logger
from app.ml.features import engineer_features, get_feature_names
from app.ml.preprocessing import preprocess_sensor_data
from app.models.prediction import MachineHealthStatus, RiskLevel

logger = get_logger(__name__)

MODEL_PATH = Path(settings.ml_model_path) / "failure_model.pkl"
MODEL_VERSION = "v1.0"

_failure_model: RandomForestClassifier | None = None


# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------

def _save_model(model: RandomForestClassifier) -> None:
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    logger.info("failure_model_saved", path=str(MODEL_PATH))


def _load_model() -> RandomForestClassifier | None:
    if MODEL_PATH.exists():
        with open(MODEL_PATH, "rb") as f:
            model = pickle.load(f)
        logger.info("failure_model_loaded", path=str(MODEL_PATH))
        return model
    return None


def get_failure_model() -> RandomForestClassifier:
    global _failure_model
    if _failure_model is None:
        _failure_model = _load_model()
    if _failure_model is None:
        raise RuntimeError("Failure model not trained yet. Run train_failure_model() first.")
    return _failure_model


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def train_failure_model(
    records: list[dict],
    labels: list[int],  # 0 = normal, 1 = failure
) -> RandomForestClassifier:
    """
    Train a Random Forest failure-prediction model.

    Args:
        records: Sensor reading dicts.
        labels:  Binary failure labels (0=normal, 1=failure).

    Returns:
        Trained model (also persisted to disk).
    """
    global _failure_model
    logger.info("training_failure_model", n_records=len(records))

    df_clean = preprocess_sensor_data(records)
    df_feat = engineer_features(df_clean)
    X = df_feat[get_feature_names()].values
    y = np.array(labels)

    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=10,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X, y)
    _save_model(model)
    _failure_model = model
    logger.info("failure_model_trained")
    return model


# ---------------------------------------------------------------------------
# Inference
# ---------------------------------------------------------------------------

def predict_failure(reading: dict) -> dict:
    """
    Predict failure probability for a single sensor reading.

    Returns:
        {
          "failure_probability": float,   # 0.0 – 1.0
          "predicted_failure": str,       # human-readable label
          "risk_level": RiskLevel,
          "health_score": float,          # 0 – 100
          "health_status": MachineHealthStatus,
        }
    """
    try:
        model = get_failure_model()
        df_clean = preprocess_sensor_data([reading])
        df_feat = engineer_features(df_clean)
        X = df_feat[get_feature_names()].values
        proba = model.predict_proba(X)[0]
        failure_prob = float(proba[1]) if len(proba) > 1 else 0.0
    except RuntimeError:
        # Model not available — use rule-based fallback
        logger.warning("failure_model_unavailable_using_rules")
        failure_prob = _rule_based_failure_probability(reading)

    risk_level = _classify_risk(failure_prob)
    health_score = round((1.0 - failure_prob) * 100, 1)
    health_status = _classify_health(health_score)
    predicted_failure = _predict_failure_type(reading, failure_prob)

    return {
        "failure_probability": failure_prob,
        "predicted_failure": predicted_failure,
        "risk_level": risk_level,
        "health_score": health_score,
        "health_status": health_status,
        "model_version": MODEL_VERSION,
    }


def calculate_machine_health(failure_probability: float) -> dict:
    """
    Derive health score and status from failure probability.
    Exposed separately so the API can recalculate without re-inference.
    """
    health_score = round((1.0 - failure_probability) * 100, 1)
    return {
        "health_score": health_score,
        "health_status": _classify_health(health_score),
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _classify_risk(prob: float) -> RiskLevel:
    if prob >= 0.75:
        return RiskLevel.CRITICAL
    if prob >= 0.5:
        return RiskLevel.HIGH
    if prob >= 0.25:
        return RiskLevel.MEDIUM
    return RiskLevel.LOW


def _classify_health(score: float) -> MachineHealthStatus:
    if score >= 80:
        return MachineHealthStatus.HEALTHY
    if score >= 60:
        return MachineHealthStatus.DEGRADED
    if score >= 40:
        return MachineHealthStatus.AT_RISK
    return MachineHealthStatus.CRITICAL


def _predict_failure_type(reading: dict, prob: float) -> str | None:
    if prob < 0.25:
        return None
    temp = reading.get("temperature") or 0
    vib = reading.get("vibration") or 0
    pressure = reading.get("pressure") or 0
    rpm = reading.get("rpm") or 0
    power = reading.get("power_consumption") or 0

    if temp > 150 and vib > 7:
        return "Bearing Failure"
    if vib > 60:
        return "Imbalance / Mechanical Looseness"
    if temp > 180:
        return "Thermal Overload"
    if pressure > 400:
        return "Pressure Seal Failure"
    if power > 500 and rpm < 1000:
        return "Motor Overload"
    return "General Mechanical Failure"


def _rule_based_failure_probability(reading: dict) -> float:
    """
    Simple rule-based fallback when no trained model is available.
    Scores based on normalised deviation from nominal ranges.
    """
    score = 0.0
    temp = reading.get("temperature") or 0
    vib = reading.get("vibration") or 0
    pressure = reading.get("pressure") or 0

    if temp > 150:
        score += min((temp - 150) / 200, 0.4)
    if vib > 7:
        score += min((vib - 7) / 50, 0.4)
    if pressure > 300:
        score += min((pressure - 300) / 400, 0.2)

    return min(score, 1.0)
