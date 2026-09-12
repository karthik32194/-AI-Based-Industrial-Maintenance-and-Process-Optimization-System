"""
Failure-risk prediction -- Phase 4 final model.

Phase 2 selected a frozen supervised strategy, Phase 4 faithfully implements it:

  * Model: HistGradientBoostingClassifier
  * Configuration: class_weight='balanced', max_depth=4, max_iter=200, random_state=42
  * Feature set: all 15 raw industrial variables (FAILURE_SENSOR_COLUMNS).
    Phase-1 engineered features (ratios, squares, z-scores) are REJECTED for this
    model (no meaningful gain, superseded).
  * Formulation: current-state failure-risk classification. The model learns the
    association between the current multivariate sensor state and the
    machine_failure label. It is NOT RUL, NOT future-failure forecasting.

Terminology:
  * Output is the continuous FAILURE RISK SCORE (the model's per-class-1 score).
    It is a ranking/risk indicator, NOT a calibrated probability of failure.
    Phase 2 found calibration insufficient; call it a score, never "probability
    of failure".
  * risk_flag = score >= threshold (default 0.15, validation-derived operating
    point, not a physical failure threshold).

No physical failure mechanism, failure type, or future horizon is claimed.
No rule-based heuristic is substituted for the model at inference.
"""
from __future__ import annotations

import pickle
from pathlib import Path

import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier

from app.core.config import settings
from app.core.logging import get_logger
from app.ml.contract import FAILURE_SENSOR_COLUMNS
from app.ml.preprocessing import FittedPreprocessor

logger = get_logger(__name__)

FAILURE_RISK_MODEL_PATH = Path(settings.ml_model_path) / "failure_risk_artifact.pkl"
MODEL_VERSION = "failure_hgb_v1.0"
# Default operating threshold, selected by Phase 2 from train-only validation
# (5-fold CV F1-max). An operating point, NOT a physical failure threshold and
# NOT a probability cutoff.
DEFAULT_THRESHOLD = 0.15

_failure_artifact: "FailureRiskArtifact | None" = None


class FailureRiskArtifact:
    """Self-describing, reproducible failure-risk artifact (model + fitted state)."""

    def __init__(
        self,
        model: HistGradientBoostingClassifier,
        preprocessor: FittedPreprocessor,
        threshold: float,
        feature_names: list[str],
        model_config: dict,
        random_state: int,
        dataset_hash: str | None,
        version: str,
        protocol: str | None = None,
    ):
        self.model = model
        self.preprocessor = preprocessor
        self.threshold = float(threshold)
        self.feature_names = list(feature_names)
        self.model_config = dict(model_config)
        self.random_state = int(random_state)
        self.dataset_hash = dataset_hash
        self.version = version
        self.protocol = protocol

    def to_dict(self) -> dict:
        return {
            "model": self.model,
            "preprocessor": self.preprocessor.to_dict(),
            "preprocessor_columns": list(self.preprocessor.columns),
            "threshold": self.threshold,
            "feature_names": self.feature_names,
            "model_config": self.model_config,
            "random_state": self.random_state,
            "dataset_hash": self.dataset_hash,
            "version": self.version,
            "protocol": self.protocol,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "FailureRiskArtifact":
        prep = FittedPreprocessor.from_dict(data["preprocessor"])
        prep.columns = list(data["preprocessor_columns"])
        return cls(
            model=data["model"],
            preprocessor=prep,
            threshold=data["threshold"],
            feature_names=data["feature_names"],
            model_config=data["model_config"],
            random_state=data["random_state"],
            dataset_hash=data.get("dataset_hash"),
            version=data.get("version", MODEL_VERSION),
            protocol=data.get("protocol"),
        )


def save_failure_risk_artifact(artifact: FailureRiskArtifact,
                               path: Path | str = FAILURE_RISK_MODEL_PATH) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as f:
        pickle.dump(artifact.to_dict(), f)
    logger.info("failure_artifact_saved", path=str(path), version=artifact.version)


def load_failure_risk_artifact(path: Path | str = FAILURE_RISK_MODEL_PATH) -> FailureRiskArtifact | None:
    path = Path(path)
    if not path.exists():
        return None
    with open(path, "rb") as f:
        return FailureRiskArtifact.from_dict(pickle.load(f))


def get_failure_risk_artifact() -> FailureRiskArtifact:
    global _failure_artifact
    if _failure_artifact is None:
        _failure_artifact = load_failure_risk_artifact()
    if _failure_artifact is None:
        raise RuntimeError("Failure-risk model not trained yet. Run train_failure_model() first.")
    return _failure_artifact


# Backward-compatible alias for existing callers.
get_failure_model = get_failure_risk_artifact


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def train_failure_model(
    records: list[dict],
    labels: list[int],  # 0 = normal, 1 = failure
    threshold: float | None = None,
    preprocessor: FittedPreprocessor | None = None,
    dataset_hash: str | None = None,
    random_state: int = 42,
) -> "FailureRiskArtifact":
    """
    Train the frozen Phase-2 failure-risk model on the 15-variable representation.

    ``records``: list of dicts over FAILURE_SENSOR_COLUMNS (15 raw vars).
    ``labels``:  binary machine_failure labels (0 normal, 1 failure).
    ``preprocessor``: optional pre-fitted preprocessor (train/serve consistent).
        When None, one is fitted on ``records`` (train data only).
    ``threshold``: default operating threshold (0.15). Persisted with the artifact.
        Must be derived from validation, NOT tuned on a held-out test set.
    Fits median-imputation preprocessing (train only), trains HistGradientBoosting
    with class_weight='balanced', persists a self-describing artifact, returns it.
    """
    global _failure_artifact
    logger.info("training_failure_model", n_records=len(records),
                feature_count=len(FAILURE_SENSOR_COLUMNS))
    if preprocessor is None:
        # Fit on train data only. No bounds: no scientific operating ranges for
        # the 15 raw variables, so median imputation only (matches anomaly path).
        preprocessor = FittedPreprocessor.fit(records, columns=FAILURE_SENSOR_COLUMNS, bounds={})
    X = preprocessor.transform(records, bounds={})
    X = X[FAILURE_SENSOR_COLUMNS]
    y = np.asarray(labels, dtype=int)

    model = HistGradientBoostingClassifier(
        class_weight="balanced",
        max_depth=4,
        max_iter=200,
        random_state=random_state,
    )
    model.fit(X, y)

    artifact = FailureRiskArtifact(
        model=model,
        preprocessor=preprocessor,
        threshold=threshold if threshold is not None else DEFAULT_THRESHOLD,
        feature_names=list(FAILURE_SENSOR_COLUMNS),
        model_config={
            "class_weight": "balanced",
            "max_depth": 4,
            "max_iter": 200,
            "random_state": random_state,
        },
        random_state=random_state,
        dataset_hash=dataset_hash,
        version=MODEL_VERSION,
        protocol="stratified 80/20 seed42 (train partition); threshold=train-only 5-fold CV F1-max",
    )
    _failure_artifact = artifact
    save_failure_risk_artifact(artifact)
    logger.info("failure_model_trained", version=MODEL_VERSION, threshold=artifact.threshold)
    return artifact


# ---------------------------------------------------------------------------
# Inference
# ---------------------------------------------------------------------------

def predict_failure(reading: dict) -> dict:
    """
    Infer failure-risk for a single sensor reading (15 raw variables).

    Returns:
        {
          "failure_risk_score": float,   # continuous risk score (higher = larger
                                         # failure-risk ranking). NOT a calibrated
                                         # probability of failure.
          "risk_flag": bool,             # score >= threshold (default 0.15)
          "health_score": float,         # derived software indicator (0-100),
                                         # NOT a validated physical health metric.
          "model_version": str,
        }
    Imputes missing/invalid values via the artifact's fitted median preprocessor
    (train/serve consistent). Requires the artifact only, never the training CSV.
    """
    try:
        artifact = get_failure_risk_artifact()
    except RuntimeError:
        logger.warning("failure_model_unavailable_safe_fallback")
        return {
            "failure_risk_score": 0.0,
            "risk_flag": False,
            "health_score": 100.0,
            "model_version": MODEL_VERSION,
        }

    df = artifact.preprocessor.transform_one(reading, bounds={})
    df = df[artifact.feature_names]          # pin feature order
    # Continuous score for class 1. Higher = larger failure-risk ranking.
    # This is the raw model score; do NOT present it as a calibrated probability.
    score = float(artifact.model.predict_proba(df)[0, 1])
    risk_flag = bool(score >= artifact.threshold)
    health_score = round((1.0 - score) * 100.0, 1)   # derived software indicator

    return {
        "failure_risk_score": round(score, 6),
        "risk_flag": risk_flag,
        "health_score": health_score,
        "model_version": artifact.version,
    }


def calculate_machine_health(failure_risk_score: float) -> dict:
    """
    Derived software health indicator from a failure-risk score.
    Presentation-layer transformation only; NOT a validated physical health metric.
    """
    return {"health_score": round((1.0 - failure_risk_score) * 100.0, 1)}