"""
Anomaly detection — Section 16 (detect_anomaly)
Uses Isolation Forest trained on normal operating data.
Model is persisted to disk and loaded on first use.
"""
from __future__ import annotations

import os
import pickle
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from app.core.config import settings
from app.core.logging import get_logger
from app.ml.features import engineer_features, get_feature_names
from app.ml.preprocessing import preprocess_sensor_data

logger = get_logger(__name__)

MODEL_PATH = Path(settings.ml_model_path) / "anomaly_model.pkl"

# Module-level model cache
_anomaly_model: IsolationForest | None = None


# ---------------------------------------------------------------------------
# Model persistence helpers
# ---------------------------------------------------------------------------

def _save_model(model: IsolationForest) -> None:
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    logger.info("anomaly_model_saved", path=str(MODEL_PATH))


def _load_model() -> IsolationForest | None:
    if MODEL_PATH.exists():
        with open(MODEL_PATH, "rb") as f:
            model = pickle.load(f)
        logger.info("anomaly_model_loaded", path=str(MODEL_PATH))
        return model
    return None


def get_anomaly_model() -> IsolationForest:
    """Return the cached model, loading from disk if needed."""
    global _anomaly_model
    if _anomaly_model is None:
        _anomaly_model = _load_model()
    if _anomaly_model is None:
        raise RuntimeError(
            "Anomaly model not trained yet. "
            "Run train_anomaly_model() first."
        )
    return _anomaly_model


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def train_anomaly_model(records: list[dict], contamination: float | None = None) -> IsolationForest:
    """
    Train an Isolation Forest on historical sensor records.

    Args:
        records: List of sensor reading dicts (from DB).
        contamination: Expected proportion of outliers. Defaults to settings value.

    Returns:
        Trained IsolationForest model (also persisted to disk).
    """
    global _anomaly_model
    contamination = contamination or settings.ml_anomaly_contamination
    logger.info("training_anomaly_model", n_records=len(records), contamination=contamination)

    df_clean = preprocess_sensor_data(records)
    df_feat = engineer_features(df_clean)

    model = IsolationForest(
        n_estimators=100,
        contamination=contamination,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(df_feat[get_feature_names()])
    _save_model(model)
    _anomaly_model = model
    logger.info("anomaly_model_trained")
    return model


# ---------------------------------------------------------------------------
# Inference
# ---------------------------------------------------------------------------

def detect_anomaly(reading: dict) -> dict:
    """
    Run anomaly detection on a single sensor reading.

    Returns:
        {
          "is_anomaly": bool,
          "anomaly_score": float,   # higher = more anomalous
          "anomaly_type": str | None,
        }
    """
    try:
        model = get_anomaly_model()
    except RuntimeError:
        # No model available — return safe default
        logger.warning("anomaly_model_unavailable_using_default")
        return {"is_anomaly": False, "anomaly_score": 0.0, "anomaly_type": None}

    df_clean = preprocess_sensor_data([reading])
    df_feat = engineer_features(df_clean)
    X = df_feat[get_feature_names()].values

    # IsolationForest: -1 = anomaly, 1 = normal
    prediction = model.predict(X)[0]
    raw_score = model.decision_function(X)[0]
    # Invert so higher = more anomalous, normalise to [0, 1]
    anomaly_score = float(np.clip(-raw_score, 0, 1))

    is_anomaly = prediction == -1
    anomaly_type = _classify_anomaly_type(reading) if is_anomaly else None

    return {
        "is_anomaly": is_anomaly,
        "anomaly_score": anomaly_score,
        "anomaly_type": anomaly_type,
    }


def _classify_anomaly_type(reading: dict) -> str:
    """Heuristic classification of the likely anomaly cause."""
    temp = reading.get("temperature") or 0
    vib = reading.get("vibration") or 0
    pressure = reading.get("pressure") or 0
    rpm = reading.get("rpm") or 0

    if temp > 200:
        return "High Temperature"
    if vib > 50:
        return "High Vibration"
    if pressure > 500:
        return "High Pressure"
    if rpm > 50_000:
        return "High RPM"
    return "Multi-Parameter Anomaly"
