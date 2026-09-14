"""
Script to train anomaly detection and failure prediction models
from the simulated IIoT dataset.

Usage:
    python scripts/train_models.py
    python scripts/train_models.py --csv ../simulated_iiot_dataset.csv
"""
import argparse
import sys
from pathlib import Path

# Add backend root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd
import numpy as np

from app.ml.anomaly import train_anomaly_model
from app.ml.prediction import train_failure_model
from app.ml.evaluation import evaluate_model
from app.core.logging import configure_logging, get_logger

configure_logging()
logger = get_logger(__name__)

DEFAULT_CSV = Path(__file__).resolve().parent.parent.parent / \
    "-AI-Based-Industrial-Maintenance-and-Process-Optimization-System" / \
    "simulated_iiot_dataset.csv"


def load_dataset(csv_path: Path) -> pd.DataFrame:
    logger.info("loading_dataset", path=str(csv_path))
    df = pd.read_csv(csv_path)
    logger.info("dataset_loaded", rows=len(df), columns=list(df.columns))
    return df


def prepare_records(df: pd.DataFrame) -> tuple[list[dict], list[int]]:
    """
    Convert DataFrame rows to sensor reading dicts and extract failure labels.
    Tries common column name patterns from industrial datasets.
    """
    col_map = {
        "temperature": ["temperature", "temp", "temperature_c"],
        "vibration": ["vibration", "vib", "vibration_mms"],
        "pressure": ["pressure", "pres", "pressure_bar"],
        "rpm": ["rpm", "rotational_speed", "speed_rpm"],
        "power_consumption": ["power", "power_consumption", "power_kw", "wattage"],
    }
    label_cols = ["failure", "label", "fault", "is_failure", "failure_flag"]

    # Build column mapping for this specific CSV
    resolved: dict[str, str] = {}
    for target, candidates in col_map.items():
        for candidate in candidates:
            matches = [c for c in df.columns if c.lower() == candidate.lower()]
            if matches:
                resolved[target] = matches[0]
                break

    # Extract failure labels
    labels: list[int] = [0] * len(df)
    for lc in label_cols:
        matches = [c for c in df.columns if c.lower() == lc.lower()]
        if matches:
            labels = df[matches[0]].fillna(0).astype(int).tolist()
            logger.info("failure_labels_found", column=matches[0], positive_rate=sum(labels) / len(labels))
            break

    records = []
    for _, row in df.iterrows():
        rec = {}
        for target, source_col in resolved.items():
            val = row.get(source_col)
            rec[target] = float(val) if pd.notna(val) else None
        records.append(rec)

    logger.info("records_prepared", count=len(records), mapped_columns=resolved)
    return records, labels


def main(csv_path: Path) -> None:
    if not csv_path.exists():
        logger.error("csv_not_found", path=str(csv_path))
        print(f"Dataset not found at: {csv_path}")
        print("Usage: python scripts/train_models.py --csv <path_to_csv>")
        sys.exit(1)

    df = load_dataset(csv_path)
    records, labels = prepare_records(df)

    # Train anomaly detection model
    logger.info("training_anomaly_model")
    train_anomaly_model(records)
    print("✓ Anomaly detection model trained and saved to models/anomaly_model.pkl")

    # Train failure prediction model
    if sum(labels) > 0:
        logger.info("training_failure_model")
        from sklearn.model_selection import train_test_split
        train_records, test_records, train_labels, test_labels = train_test_split(
            records, labels, test_size=0.2, random_state=42, stratify=labels
        )
        train_failure_model(train_records, train_labels)

        # Evaluate on test set
        from app.ml.prediction import predict_failure
        test_preds = [predict_failure(r) for r in test_records]
        y_pred = [1 if p["failure_probability"] >= 0.5 else 0 for p in test_preds]
        y_proba = [p["failure_probability"] for p in test_preds]
        metrics = evaluate_model(test_labels, y_pred, y_proba)
        print(f"✓ Failure prediction model trained and saved to models/failure_model.pkl")
        print(f"  Accuracy:  {metrics['accuracy']}")
        print(f"  Precision: {metrics['precision']}")
        print(f"  Recall:    {metrics['recall']}")
        print(f"  F1:        {metrics['f1_score']}")
        if metrics.get("roc_auc"):
            print(f"  ROC-AUC:   {metrics['roc_auc']}")
    else:
        logger.warning("no_failure_labels_skipping_supervised_training")
        print("⚠ No failure labels found — only anomaly model trained.")
        print("  Add a 'failure' column to your dataset for supervised training.")


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
