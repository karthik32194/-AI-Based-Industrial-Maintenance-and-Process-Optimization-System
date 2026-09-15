"""
Script to train anomaly detection and failure-risk prediction models
from the simulated IIoT dataset.

Phase 1 contract:
  * Loads the CSV, maps dataset columns to the canonical ML schema
    (see ``app.ml.contract``), extracts the target ``machine_failure``.
  * Fits ONE preprocessing pipeline on the training split and saves it as
    ``pipeline_state.pkl`` (legacy 5-variable canonical surface).

Phase 3:
  * Trains the unsupervised anomaly Isolation Forest over the 15 raw variables.

Phase 4 (frozen strategy):
  * Trains the final failure-risk model: HistGradientBoostingClassifier,
    class_weight='balanced', 15 raw variables, no engineered features.
    Persists a self-describing ``failure_risk_artifact.pkl`` (model +
    fitted preprocessor + threshold + metadata). Machine-failure labels train
    the model but do NOT fabricate physical failure meaning.
  * Reserved frozen test set written to experiments_out/frozen_test.csv and
    evaluated once (threshold 0.15 from train-only validation, untouched here).

Usage:
    python scripts/train_models.py
    python scripts/train_models.py --csv <path_to_csv>
"""
import argparse
import hashlib
import sys
from pathlib import Path

# Add backend root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd
from sklearn.model_selection import train_test_split

from app.core.config import settings
from app.core.logging import configure_logging, get_logger
from app.ml.anomaly import train_anomaly_model
from app.ml.contract import (
    ANOMALY_SENSOR_COLUMNS,
    FAILURE_SENSOR_COLUMNS,
    SENSOR_COLUMNS,
    TARGET_COLUMN,
    map_dataset_to_canonical,
)
from app.ml.evaluation import evaluate_model
from app.ml.features import fit_zscore_stats
from app.ml.preprocessing import (
    FittedPreprocessor,
    PipelineState,
    save_pipeline_state,
)
from app.ml.prediction import train_failure_model

configure_logging()
logger = get_logger(__name__)

# Dataset lives at the repository root (next to the backend/ directory).
DEFAULT_CSV = Path(__file__).resolve().parent.parent.parent / "simulated_iiot_dataset.csv"
EXPERIMENTS_OUT = Path(__file__).resolve().parent.parent / "experiments_out"

PIPELINE_STATE_PATH = Path(settings.ml_model_path) / "pipeline_state.pkl"
FROZEN_TEST_PATH = EXPERIMENTS_OUT / "frozen_test.csv"


def load_dataset(csv_path: Path) -> pd.DataFrame:
    logger.info("loading_dataset", path=str(csv_path))
    df = pd.read_csv(csv_path)
    logger.info("dataset_loaded", rows=len(df), columns=list(df.columns))
    return df


def dataset_hash(df: pd.DataFrame) -> str:
    """Content hash of the raw dataset for artifact versioning."""
    payload = df.to_csv(index=False).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def prepare_records(df: pd.DataFrame) -> tuple[list[dict], list[int]]:
    """
    Build canonical ML records and failure labels from the dataset DataFrame.

    Column resolution is driven by the canonical contract
    (``app.ml.contract``), not by ad-hoc name guessing.
    """
    dataset_to_canonical = map_dataset_to_canonical(list(df.columns))
    canonical_to_dataset = {v: k for k, v in dataset_to_canonical.items()}

    records: list[dict] = []
    rows = df.to_dict("records")
    for row in rows:
        rec: dict = {}
        for canon in SENSOR_COLUMNS:
            src = canonical_to_dataset.get(canon)
            val = row.get(src) if src is not None else None
            rec[canon] = float(val) if pd.notna(val) else None
        records.append(rec)

    # Extract target
    if TARGET_COLUMN in df.columns:
        labels = df[TARGET_COLUMN].fillna(0).astype(int).tolist()
        logger.info(
            "failure_labels_found",
            column=TARGET_COLUMN,
            positive_rate=sum(labels) / len(labels),
        )
    else:
        logger.warning("target_column_missing", column=TARGET_COLUMN)
        labels = [0] * len(df)

    logger.info("records_prepared", count=len(records), mapped_columns=dataset_to_canonical)
    return records, labels


def fixed_cols_records(df: pd.DataFrame, cols: list[str]) -> list[dict]:
    """Records over an arbitrary fixed column list (float or None, aligned to rows)."""
    rows = df[cols].to_dict("records")
    for r in rows:
        for c in cols:
            v = r[c]
            r[c] = float(v) if pd.notna(v) else None
    return rows


def main(csv_path: Path) -> None:
    if not csv_path.exists():
        logger.error("csv_not_found", path=str(csv_path))
        print(f"Dataset not found at: {csv_path}")
        sys.exit(1)

    df = load_dataset(csv_path)
    records, labels = prepare_records(df)

    # Stratified split (frozen protocol, seed 42, 80/20). Same partition that
    # produced experiments_out/reserved_test.csv in Phase 2 (train portion).
    stratify = labels if 1 < len(set(labels)) else None
    train_idx, test_idx, _, test_labels = train_test_split(
        list(range(len(df))), labels, test_size=0.2, random_state=42, stratify=stratify
    )
    train_records = [records[i] for i in train_idx]
    train_labels = [labels[i] for i in train_idx]

    # 15-variable representations aligned to train/test rows.
    failure_train_records = [fixed_cols_records(df, FAILURE_SENSOR_COLUMNS)[i] for i in train_idx]
    anomaly_train_records = [fixed_cols_records(df, ANOMALY_SENSOR_COLUMNS)[i] for i in train_idx]

    # 1. Legacy canonical preprocessing + feature pipeline (Phase 1 surface,
    #    kept for earlier consumers); fitted on TRAIN only.
    preprocessor = FittedPreprocessor.fit(train_records)
    zscore_stats = fit_zscore_stats(preprocessor.transform(train_records))
    state = PipelineState(preprocessor=preprocessor, zscore_stats=zscore_stats)
    save_pipeline_state(state, PIPELINE_STATE_PATH)
    print(f"[OK] Legacy pipeline state saved to {PIPELINE_STATE_PATH}")

    # 2. Anomaly detection model (unsupervised, Phase 3). machine_failure not
    #    used as anomaly ground truth.
    logger.info("training_anomaly_model")
    train_anomaly_model(anomaly_train_records, dataset_hash=dataset_hash(df))
    print("[OK] Anomaly model trained and saved to models/anomaly_artifact.pkl")

    # 3. Failure-risk model (Phase 4 frozen strategy). 15 raw vars, HGB balanced.
    #    Threshold 0.15 is the pre-frozen validation-derived operating point;
    #    the reserved test set is NOT used to tune it here.
    logger.info("training_failure_risk_model")
    train_failure_model(
        failure_train_records,
        train_labels,
        dataset_hash=dataset_hash(df),
    )
    print("[OK] Failure-risk model trained and saved to models/failure_risk_artifact.pkl")

    # 4. Reserve frozen test set (complement) exactly once, evaluate once.
    EXPERIMENTS_OUT.mkdir(parents=True, exist_ok=True)
    df_test = df.iloc[test_idx].reset_index(drop=True)
    df_test.to_csv(FROZEN_TEST_PATH, index=False)
    print(f"[OK] Frozen test written to {FROZEN_TEST_PATH} ({len(df_test)} rows)")

    test_failure_records = [fixed_cols_records(df, FAILURE_SENSOR_COLUMNS)[i] for i in test_idx]
    from app.ml.prediction import predict_failure
    y_true = [int(v) for v in test_labels]
    y_score = []
    for r in test_failure_records:
        y_score.append(predict_failure(r)["failure_risk_score"])
    y_pred = [1 if s >= 0.15 else 0 for s in y_score]
    metrics = evaluate_model(y_true, y_pred, y_proba=y_score)
    print("[OK] Frozen test evaluation (threshold 0.15, once):")
    print(f"  Accuracy:  {metrics['accuracy']}")
    print(f"  Precision: {metrics['precision']}")
    print(f"  Recall:    {metrics['recall']}")
    print(f"  F1:        {metrics['f1_score']}")
    print(f"  ROC-AUC:   {metrics['roc_auc']}")
    print(f"  PR-AUC:    {metrics['pr_auc']}")
    print(f"  Confusion: {metrics['confusion_matrix']}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train ML models from IIoT dataset")
    parser.add_argument(
        "--csv",
        type=Path,
        default=DEFAULT_CSV,
        help="Path to the sensor dataset CSV file",
    )
    args = parser.parse_args()
    main(args.csv)