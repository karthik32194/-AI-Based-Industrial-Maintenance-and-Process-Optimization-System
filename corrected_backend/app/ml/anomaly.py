
"""Isolation Forest anomaly detection using all 15 sensor channels."""
from __future__ import annotations

from pathlib import Path
import joblib
import numpy as np
from sklearn.ensemble import IsolationForest

from app.core.config import settings
from app.core.logging import get_logger
from app.ml.preprocessing import SENSOR_COLUMNS, preprocess_sensor_data, validate_reading, fit_imputation_values

logger = get_logger(__name__)
MODEL_PATH = Path(settings.ml_model_path) / "anomaly_model.pkl"
MODEL_VERSION = "iforest-v1.0"
_anomaly_artifact: dict | None = None


def _save_artifact(artifact: dict) -> None:
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, MODEL_PATH)


def _load_artifact() -> dict | None:
    if not MODEL_PATH.exists():
        return None
    artifact = joblib.load(MODEL_PATH)
    if isinstance(artifact, IsolationForest):
        return {"model": artifact, "feature_columns": SENSOR_COLUMNS, "imputation_values": {}}
    return artifact


def get_anomaly_artifact() -> dict:
    global _anomaly_artifact
    if _anomaly_artifact is None:
        _anomaly_artifact = _load_artifact()
    if _anomaly_artifact is None:
        raise RuntimeError("Anomaly model not trained yet. Run train_models.py first.")
    return _anomaly_artifact


def get_anomaly_model() -> IsolationForest:
    return get_anomaly_artifact()["model"]


def train_anomaly_model(records: list[dict], contamination: float | None = None) -> IsolationForest:
    global _anomaly_artifact
    contamination = settings.ml_anomaly_contamination if contamination is None else contamination
    imputation_values = fit_imputation_values(records)
    X = preprocess_sensor_data(records, imputation_values)[SENSOR_COLUMNS]

    model = IsolationForest(
        n_estimators=100,
        contamination=contamination,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X)
    artifact = {
        "model": model,
        "feature_columns": SENSOR_COLUMNS,
        "imputation_values": imputation_values,
        "model_version": MODEL_VERSION,
        "contamination": contamination,
    }
    _save_artifact(artifact)
    _anomaly_artifact = artifact
    return model


def detect_anomaly(reading: dict) -> dict:
    reading = validate_reading(reading)
    artifact = get_anomaly_artifact()
    model: IsolationForest = artifact["model"]
    imputation_values = artifact.get("imputation_values", {})
    X = preprocess_sensor_data([reading], imputation_values)[SENSOR_COLUMNS]

    prediction = int(model.predict(X)[0])
    raw_score = float(model.decision_function(X)[0])
    # Match the notebook convention: IsolationForest -1 is anomaly.
    anomaly_score = float(np.clip(-raw_score, 0.0, 1.0))
    is_anomaly = prediction == -1
    anomaly_type = _classify_anomaly_type(reading) if is_anomaly else None

    return {
        "is_anomaly": is_anomaly,
        "anomaly_score": anomaly_score,
        "anomaly_type": anomaly_type,
    }


def _classify_anomaly_type(reading: dict) -> str:
    """Describe the dominant unusual channel without claiming a failure cause."""
    values = {}
    for col in SENSOR_COLUMNS:
        value = reading.get(col)
        if value is not None:
            values[col] = float(value)
    if not values:
        return "Multi-Parameter Anomaly"
    return "Multi-Parameter Anomaly"
