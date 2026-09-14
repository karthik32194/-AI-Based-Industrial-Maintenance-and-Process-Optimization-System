
"""Failure-risk prediction using the validated class-weighted XGBoost model."""
from __future__ import annotations

from pathlib import Path
import joblib
import numpy as np
from xgboost import XGBClassifier

from app.core.config import settings
from app.core.logging import get_logger
from app.ml.features import get_feature_names
from app.ml.preprocessing import build_prediction_features, fit_imputation_values, validate_reading
from app.models.prediction import MachineHealthStatus, RiskLevel

logger = get_logger(__name__)

MODEL_PATH = Path(settings.ml_model_path) / "failure_model.pkl"
MODEL_VERSION = "xgb-v1.0"
_failure_artifact: dict | None = None


def _save_artifact(artifact: dict) -> None:
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, MODEL_PATH)
    logger.info("failure_model_saved", path=str(MODEL_PATH))


def _load_artifact() -> dict | None:
    if not MODEL_PATH.exists():
        return None
    artifact = joblib.load(MODEL_PATH)
    if isinstance(artifact, XGBClassifier):
        # Legacy artifact compatibility.
        return {
            "model": artifact,
            "threshold": 0.5,
            "feature_columns": get_feature_names(),
            "imputation_values": {},
            "model_version": "legacy-xgb",
        }
    return artifact


def get_failure_artifact() -> dict:
    global _failure_artifact
    if _failure_artifact is None:
        _failure_artifact = _load_artifact()
    if _failure_artifact is None:
        raise RuntimeError("Failure model not trained yet. Run train_models.py first.")
    return _failure_artifact


def get_failure_model() -> XGBClassifier:
    return get_failure_artifact()["model"]


def train_failure_model(records: list[dict], labels: list[int]) -> XGBClassifier:
    """Train the same class-weighted XGBoost configuration used in the notebook."""
    global _failure_artifact
    if len(records) != len(labels):
        raise ValueError("records and labels must have the same length")
    if len(set(labels)) < 2:
        raise ValueError("Training requires both normal (0) and failure (1) labels")

    # The dataset has no missing values, but keeping medians in the artifact
    # makes production inference safe for partial sensor payloads.
    imputation_values = fit_imputation_values(records)
    X = build_prediction_features(records, imputation_values)
    feature_columns = get_feature_names()
    X = X[feature_columns]
    y = np.asarray(labels, dtype=int)

    negative = int((y == 0).sum())
    positive = int((y == 1).sum())
    if positive == 0:
        raise ValueError("No positive failure examples found")
    scale_pos_weight = negative / positive

    model = XGBClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        scale_pos_weight=scale_pos_weight,
        random_state=42,
        eval_metric="logloss",
    )
    model.fit(X, y)

    artifact = {
        "model": model,
        "threshold": 0.50,
        "feature_columns": feature_columns,
        "imputation_values": imputation_values,
        "scale_pos_weight": scale_pos_weight,
        "model_version": MODEL_VERSION,
    }
    _save_artifact(artifact)
    _failure_artifact = artifact
    return model


def update_failure_threshold(threshold: float) -> None:
    """Persist a validated threshold after leakage-free validation tuning."""
    global _failure_artifact
    artifact = get_failure_artifact()
    artifact["threshold"] = float(threshold)
    _save_artifact(artifact)
    _failure_artifact = artifact


def predict_failure(reading: dict) -> dict:
    """Return probability, notebook-compatible risk, and health outputs."""
    reading = validate_reading(reading)
    artifact = get_failure_artifact()
    model: XGBClassifier = artifact["model"]
    feature_columns = artifact.get("feature_columns", get_feature_names())
    imputation_values = artifact.get("imputation_values", {})

    X = build_prediction_features([reading], imputation_values)[feature_columns]
    failure_prob = float(model.predict_proba(X)[0][1])
    threshold = float(artifact.get("threshold", 0.5))

    risk_level = _classify_risk(failure_prob)
    health_score = round((1.0 - failure_prob) * 100.0, 1)
    predicted_failure = "Machine Failure Risk" if failure_prob >= threshold else None

    return {
        "failure_probability": failure_prob,
        "predicted_failure": predicted_failure,
        "risk_level": risk_level,
        "health_score": health_score,
        "health_status": _classify_health(health_score),
        "model_version": artifact.get("model_version", MODEL_VERSION),
    }


def calculate_machine_health(failure_probability: float) -> dict:
    health_score = round((1.0 - failure_probability) * 100.0, 1)
    return {"health_score": health_score, "health_status": _classify_health(health_score)}


def _classify_risk(prob: float) -> RiskLevel:
    # Exact notebook risk bands: <0.30 LOW, <0.60 MEDIUM, otherwise HIGH.
    if prob < 0.30:
        return RiskLevel.LOW
    if prob < 0.60:
        return RiskLevel.MEDIUM
    return RiskLevel.HIGH


def _classify_health(score: float) -> MachineHealthStatus:
    if score >= 80:
        return MachineHealthStatus.HEALTHY
    if score >= 60:
        return MachineHealthStatus.DEGRADED
    if score >= 40:
        return MachineHealthStatus.AT_RISK
    return MachineHealthStatus.CRITICAL
