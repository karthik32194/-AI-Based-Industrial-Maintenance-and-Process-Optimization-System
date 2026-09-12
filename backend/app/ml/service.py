"""
ML integration boundary -- Phase 5.

The single place where the backend turns a stored/raw sensor reading into the
15-variable dataset-name representation the Phase 3 anomaly and Phase 4
failure-risk artifacts consume, and where model availability is checked
explicitly.

PHASE 5 HARD CONSTRAINT (Step 5):
  * If any required ML artifact is missing, corrupt, or incompatible, the
    result is represented EXPLICITLY as ML_UNAVAILABLE. The backend must NOT
    silently map that to a healthy/low-risk result (score 0, flag False).
    That would fabricate a false sense of safety.

This module deliberately does NOT:
  * retrain models at request time,
  * read the training CSV,
  * re-implement preprocessing (the artifacts carry their own fitted
    preprocessors),
  * change the Phase 3 / Phase 4 model strategy or output contract.
"""
from __future__ import annotations

from app.core.logging import get_logger
from app.ml.anomaly import detect_anomaly, get_anomaly_artifact
from app.ml.contract import (
    DATASET_TO_CANONICAL,
    FAILURE_SENSOR_COLUMNS,
)
from app.ml.prediction import (
    get_failure_risk_artifact,
    predict_failure,
)

logger = get_logger(__name__)

# ML availability status values, persisted on the Prediction record.
ML_STATUS_VALID = "VALID"
ML_STATUS_UNAVAILABLE = "UNAVAILABLE"


class MLUnavailableError(RuntimeError):
    """Raised when a required ML artifact cannot be loaded for inference."""


def build_pipeline_reading(raw: dict) -> dict:
    """
    Map a stored/raw sensor reading into the 15-variable dataset-name
    representation the ML artifacts expect.

    ``raw`` may be keyed by canonical names (temperature, vibration, pressure,
    rpm, power_consumption) or by dataset names (rotation_speed, active_power)
    or a mix. The canonical mapping in ``app.ml.contract`` resolves it; every
    other dataset name is used as-is. Unknown or missing values stay None and
    are median-imputed by the artifact's own fitted preprocessor.

    The output is keyed by the pinned ``FAILURE_SENSOR_COLUMNS`` order so the
    artifacts receive a stable feature vector.
    """
    reading: dict = {}
    for col in FAILURE_SENSOR_COLUMNS:
        if col in raw:
            # Dataset name presented directly (e.g. rotation_speed, active_power).
            value = raw[col]
        else:
            # Fall back to the canonical source for the two renamed fields
            # (rotation_speed -> rpm, active_power -> power_consumption).
            canonical = DATASET_TO_CANONICAL.get(col)
            value = raw.get(canonical) if canonical is not None else None
        reading[col] = value
    return reading


def _is_available(loader) -> bool:
    """True if the given cached artifact loader resolves a usable artifact."""
    try:
        loader()
        return True
    except RuntimeError:
        return False


def available() -> tuple[bool, list[str]]:
    """
    Return (both_artifacts_available, list_of_missing_names).

    Cache-aware: the same cached artifacts that ``detect_anomaly`` and
    ``predict_failure`` use are checked, so ``available`` and ``run_inference``
    can never disagree on whether inference will succeed.
    """
    missing: list[str] = []
    if not _is_available(get_anomaly_artifact):
        missing.append("anomaly")
    if not _is_available(get_failure_risk_artifact):
        missing.append("failure-risk")
    return len(missing) == 0, missing


def run_inference(reading: dict) -> dict:
    """
    Run both ML models over a single 15-variable reading.

    Args:
        reading: 15-variable dataset-name representation (see build_pipeline_reading).

    Returns:
        {
            "ml_status": "VALID",
            "anomaly_result": {...detect_anomaly output...},
            "failure_result": {...predict_failure output...},
        }

    Raises:
        MLUnavailableError: if any required artifact is unavailable. The
            caller must surface this as ML_UNAVAILABLE, never as healthy.
    """
    ok, missing = available()
    if not ok:
        logger.error("ml_unavailable", missing=",".join(missing))
        raise MLUnavailableError("ML artifact(s) unavailable: " + ", ".join(missing))

    anomaly_result = detect_anomaly(reading)
    failure_result = predict_failure(reading)

    return {
        "ml_status": ML_STATUS_VALID,
        "anomaly_result": anomaly_result,
        "failure_result": failure_result,
    }