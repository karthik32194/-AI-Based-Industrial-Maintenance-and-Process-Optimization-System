
"""Train the production ML artifacts from simulated_iiot_dataset.csv.

The supervised model intentionally matches the validated notebook:
15 sensor columns + hour/day/month/day_of_week -> class-weighted XGBoost.
Isolation Forest uses all 15 sensor columns and is trained on normal rows.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import joblib
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import f1_score

from app.ml.anomaly import train_anomaly_model
from app.ml.prediction import train_failure_model, update_failure_threshold
from app.ml.preprocessing import build_prediction_features, fit_imputation_values
from app.ml.features import get_feature_names

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CSV = REPO_ROOT / "simulated_iiot_dataset.csv"


def load_dataset(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    required = get_feature_names()[:15] + ["machine_failure", "timestamp"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Dataset is missing required columns: {missing}")
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    if df["timestamp"].isna().any():
        raise ValueError("Dataset contains invalid timestamps")
    return df


def records_from_df(df: pd.DataFrame) -> list[dict]:
    return df.to_dict(orient="records")


def tune_threshold(records: list[dict], labels: list[int]) -> float:
    """Tune F1 threshold on a validation split only; test data is never used."""
    train_records, val_records, train_y, val_y = train_test_split(
        records, labels, test_size=0.2, random_state=42, stratify=labels
    )
    imputation = fit_imputation_values(train_records)
    # Build a temporary model using the same training configuration.
    from xgboost import XGBClassifier
    import numpy as np
    Xtr = build_prediction_features(train_records, imputation)[get_feature_names()]
    Xv = build_prediction_features(val_records, imputation)[get_feature_names()]
    ytr = np.asarray(train_y, dtype=int)
    negative = int((ytr == 0).sum())
    positive = int((ytr == 1).sum())
    model = XGBClassifier(
        n_estimators=100, max_depth=4, learning_rate=0.1,
        scale_pos_weight=negative / positive, random_state=42,
        eval_metric="logloss",
    )
    model.fit(Xtr, ytr)
    probs = model.predict_proba(Xv)[:, 1]
    best_threshold, best_f1 = 0.5, -1.0
    for threshold in [i / 100 for i in range(10, 91)]:
        score = f1_score(val_y, (probs >= threshold).astype(int), zero_division=0)
        if score > best_f1:
            best_f1, best_threshold = score, threshold
    print(f"Validation-selected threshold: {best_threshold:.2f} (F1={best_f1:.3f})")
    return float(best_threshold)


def main(csv_path: Path) -> None:
    if not csv_path.exists():
        raise SystemExit(f"Dataset not found: {csv_path}")

    df = load_dataset(csv_path)
    records = records_from_df(df)
    labels = df["machine_failure"].astype(int).tolist()

    print(f"Dataset: {len(df)} rows")
    print(f"Failure distribution: {df['machine_failure'].value_counts().to_dict()}")

    # Match the notebook's supervised split: 80% train / 20% test, stratified.
    train_records, test_records, train_labels, test_labels = train_test_split(
        records, labels, test_size=0.2, random_state=42, stratify=labels
    )

    print("Training anomaly model on normal-operation sensor behavior...")
    normal_records = [r for r, y in zip(records, labels) if y == 0]
    train_anomaly_model(normal_records, contamination=0.10)
    print("Saved models/anomaly_model.pkl")

    print("Training class-weighted XGBoost failure model...")
    # The notebook's final XGBoost is trained on X_train, not the held-out test set.
    train_failure_model(train_records, train_labels)
    threshold = tune_threshold(train_records, train_labels)
    update_failure_threshold(threshold)
    print("Saved models/failure_model.pkl")
    print(f"Production failure threshold: {threshold:.2f}")
    print("Feature count:", len(get_feature_names()))
    print("Features:", get_feature_names())


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    args = parser.parse_args()
    main(args.csv)
