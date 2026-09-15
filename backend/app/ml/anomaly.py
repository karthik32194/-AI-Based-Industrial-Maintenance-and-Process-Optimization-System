"""
Anomaly detection -- unsupervised Isolation Forest over the full multivariate
machine operating state.

Phase 3 design (evidence-based; see backend/experiments_out/anomaly_experiment.json
and PHASE 3 report):

  * Representation: all 15 raw industrial variables (ANOMALY_SENSOR_COLUMNS).
    Phase 2 selected this representation; Isolation Forest is scale-invariant
    for the tree splits used (monotone per-feature transform does not change the
    learned model), so no scaling is added.
  * Training population: all observations (the ``contamination`` parameter
    accounts for outliers). Machine-failure labels are NOT used as anomaly
    ground truth; the model is unsupervised.
  * Contamination: 0.05 operating assumption. Anomaly prevalence is not
    scientifically knowable here (failure prevalence != anomaly prevalence), so
    this is a documented operating assumption, chosen to flag the rarest states.
  * Score: anomaly_score = -decision_function(X). Higher = more abnormal. This is
    a deviation score, NOT a probability.
  * Threshold: the train-side (1 - contamination) quantile of the score, derived
    at fit time on training data only and persisted. No test-set contamination.
  * Anomaly types: not implemented. The heuristic physical thresholds that used
    to label "High Temperature" etc. are unrealistic at this dataset's scale and
    were removed. A specific type is returned only when statistically evidenced;
    for now the detector reports a generic multivariate-deviation explanation.

Current risk of conflation: an anomaly here means "this multivariate state is
unusual relative to the learned normal distribution" -- NOT "machine_failure=1".
"""
from __future__ import annotations

import pickle
from pathlib import Path

import numpy as np
from sklearn.ensemble import IsolationForest

from app.core.config import settings
from app.core.logging import get_logger
from app.ml.contract import ANOMALY_SENSOR_COLUMNS
from app.ml.preprocessing import FittedPreprocessor

logger = get_logger(__name__)

ANOMALY_MODEL_PATH = Path(settings.ml_model_path) / "anomaly_artifact.pkl"
MODEL_VERSION = "anomaly-v1.0"
# Operating-assumption contamination (documented; see module docstring).
OPERATING_CONTAMINATION = 0.05
_ESTIMATORS = 300
_SEED = 42

# Module-level cached artifact so serving avoids disk reads on every call.
_artifact: "AnomalyArtifact | None" = None


class AnomalyArtifact:
    """Self-describing, reproducible anomaly artifact (model + fitted state)."""

    def __init__(self, model: IsolationForest, preprocessor: FittedPreprocessor,
                 threshold: float, contamination: float, feature_names: list[str],
                 random_state: int, dataset_hash: str | None, version: str):
        self.model = model
        self.preprocessor = preprocessor
        self.threshold = float(threshold)
        self.contamination = float(contamination)
        self.feature_names = list(feature_names)
        self.random_state = int(random_state)
        self.dataset_hash = dataset_hash
        self.version = version

    def to_dict(self) -> dict:
        return {
            "model": self.model,
            "preprocessor": self.preprocessor.to_dict(),
            "preprocessor_columns": list(self.preprocessor.columns),
            "threshold": self.threshold,
            "contamination": self.contamination,
            "feature_names": self.feature_names,
            "random_state": self.random_state,
            "dataset_hash": self.dataset_hash,
            "version": self.version,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "AnomalyArtifact":
        prep = FittedPreprocessor.from_dict(data["preprocessor"])
        prep.columns = list(data["preprocessor_columns"])
        return cls(
            model=data["model"],
            preprocessor=prep,
            threshold=data["threshold"],
            contamination=data["contamination"],
            feature_names=data["feature_names"],
            random_state=data["random_state"],
            dataset_hash=data.get("dataset_hash"),
            version=data.get("version", MODEL_VERSION),
        )


def save_anomaly_artifact(artifact: AnomalyArtifact, path: Path | str = ANOMALY_MODEL_PATH) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as f:
        pickle.dump(artifact.to_dict(), f)
    logger.info("anomaly_artifact_saved", path=str(path), version=artifact.version)


def load_anomaly_artifact(path: Path | str = ANOMALY_MODEL_PATH) -> AnomalyArtifact | None:
    path = Path(path)
    if not path.exists():
        return None
    with open(path, "rb") as f:
        return AnomalyArtifact.from_dict(pickle.load(f))


def get_anomaly_artifact() -> AnomalyArtifact:
    global _artifact
    if _artifact is None:
        _artifact = load_anomaly_artifact()
    if _artifact is None:
        raise RuntimeError("Anomaly model not trained yet. Run train_anomaly_model() first.")
    return _artifact


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def train_anomaly_model(
    records: list[dict],
    contamination: float | None = None,
    dataset_hash: str | None = None,
    n_estimators: int = _ESTIMATORS,
    random_state: int = _SEED,
) -> "AnomalyArtifact":
    """
    Train an unsupervised Isolation Forest over the 15-variable representation.

    ``records``: list of dicts with the 15 ``ANOMALY_SENSOR_COLUMNS`` keys.
    ``contamination``: operating assumption (default 0.05); anomaly prevalence
        is not knowable from the data, so this is documented as an assumption,
        not ground truth.
    Fits a median-imputation preprocessor on TRAIN data, fits the detector, and
    derives the decision threshold from the train score quantile (no test touch).
    Persists and returns a self-describing ``AnomalyArtifact``.
    """
    global _artifact
    contamination = contamination if contamination is not None else OPERATING_CONTAMINATION
    logger.info("training_anomaly_model", n_records=len(records),
                contamination=contamination, feature_count=len(ANOMALY_SENSOR_COLUMNS))

    # Fit preprocessing on train only (median imputation over 15 columns).
    preprocessor = FittedPreprocessor.fit(records, columns=ANOMALY_SENSOR_COLUMNS, bounds={})
    X = preprocessor.transform(records, bounds={})

    model = IsolationForest(
        n_estimators=n_estimators,
        contamination=contamination,
        random_state=random_state,
        n_jobs=-1,
    )
    model.fit(X)

    # score: higher = more abnormal. Threshold = train (1-contamination) quantile.
    train_score = -model.decision_function(X)
    threshold = float(np.quantile(train_score, 1.0 - contamination))

    artifact = AnomalyArtifact(
        model=model,
        preprocessor=preprocessor,
        threshold=threshold,
        contamination=contamination,
        feature_names=list(ANOMALY_SENSOR_COLUMNS),
        random_state=random_state,
        dataset_hash=dataset_hash,
        version=MODEL_VERSION,
    )
    _artifact = artifact
    save_anomaly_artifact(artifact)
    logger.info("anomaly_model_trained", threshold=threshold, flagged_rate=float(contamination))
    return artifact


# ---------------------------------------------------------------------------
# Inference
# ---------------------------------------------------------------------------

def detect_anomaly(reading: dict) -> dict:
    """
    Detect whether a single sensor reading is unusual relative to the learned
    normal multivariate distribution.

    Returns:
        {
          "is_anomaly": bool,
          "anomaly_score": float,   # deviation score, higher = more abnormal (not a probability)
          "anomaly_type": None | str,
          "model_version": str,
        }
    """
    try:
        artifact = get_anomaly_artifact()
    except RuntimeError:
        logger.warning("anomaly_model_unavailable_using_default")
        return {"is_anomaly": False, "anomaly_score": 0.0,
                "anomaly_type": None, "model_version": MODEL_VERSION}

    df = artifact.preprocessor.transform_one(reading, bounds={})
    df = df[artifact.feature_names]           # pin feature order
    score = float(-artifact.model.decision_function(df.values)[0])

    is_anomaly = score >= artifact.threshold
    return {
        "is_anomaly": bool(is_anomaly),
        "anomaly_score": round(score, 6),
        "anomaly_type": None if not is_anomaly else ANOMALY_TYPE_GENERIC,
        "model_version": artifact.version,
    }


# Generic explanation used when an anomaly is detected. No specific physical
# type (thermal/vibration/pressure) is claimed because the label mechanism is
# unknown and the heuristic thresholds were unrealistic.
ANOMALY_TYPE_GENERIC = "Multivariate state deviates from learned normal distribution"