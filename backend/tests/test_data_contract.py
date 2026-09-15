"""
Phase 1 data-contract tests.

Prove:
  * dataset schema is recognised against the canonical contract;
  * canonical schema, feature names and ordering are deterministic;
  * missing/invalid handling is deterministic (fitted imputation);
  * zero denominators never yield inf/NaN;
  * a full valid row passes the complete pipeline;
  * training-time transform and inference-time transform of a single row
    agree when using the same fitted preprocessing state (no train/serve skew);
  * the training script maps every canonical column and extracts labels.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from app.ml import contract, features
from app.ml.features import engineer_features, fit_zscore_stats, get_feature_names
from app.ml.preprocessing import FittedPreprocessor

# backend/tests -> backend -> repo root
REPO_ROOT = Path(__file__).resolve().parents[2]
DATASET_PATH = REPO_ROOT / "simulated_iiot_dataset.csv"

VALID = {
    "temperature": 75.0,
    "vibration": 0.5,
    "pressure": 30.0,
    "rpm": 1500.0,
    "power_consumption": 100.0,
}


def _batch() -> list[dict]:
    return [
        {"temperature": 75, "vibration": 0.5, "pressure": 30, "rpm": 1500, "power_consumption": 100},
        {"temperature": 80, "vibration": 0.6, "pressure": 31, "rpm": 1520, "power_consumption": 105},
        {"temperature": 70, "vibration": 0.4, "pressure": 29, "rpm": 1480, "power_consumption": 95},
        {"temperature": 85, "vibration": 0.7, "pressure": 32, "rpm": 1490, "power_consumption": 110},
    ]


def _fit() -> tuple[FittedPreprocessor, dict]:
    records = _batch()
    prep = FittedPreprocessor.fit(records)
    zscore_stats = fit_zscore_stats(prep.transform(records))
    return prep, zscore_stats


# ---------------------------------------------------------------------------
# Dataset schema recognition
# ---------------------------------------------------------------------------

def test_dataset_columns_recognized():
    cols = list(pd.read_csv(DATASET_PATH, nrows=1).columns)
    assert sorted(cols) == sorted(contract.DATASET_COLUMNS)


def test_dataset_to_canonical_mapping_complete():
    df_cols = list(pd.read_csv(DATASET_PATH, nrows=1).columns)
    mapping = contract.map_dataset_to_canonical(df_cols)
    # every canonical ML column resolves from the dataset
    assert set(mapping.values()) == set(contract.SENSOR_COLUMNS)
    # explicit renames honoured
    assert mapping["rotation_speed"] == "rpm"
    assert mapping["active_power"] == "power_consumption"


def test_target_and_metadata_identified():
    assert contract.TARGET_COLUMN == "machine_failure"
    assert "timestamp" in contract.TEMPORAL_COLUMNS
    # target must not be part of the sensor input set
    assert contract.TARGET_COLUMN not in contract.SENSOR_COLUMNS


# ---------------------------------------------------------------------------
# Canonical schema determinism
# ---------------------------------------------------------------------------

def test_canonical_schema_deterministic():
    assert contract.SENSOR_COLUMNS == [
        "temperature", "vibration", "pressure", "rpm", "power_consumption",
    ]


def test_feature_names_and_order_deterministic():
    names = get_feature_names()
    assert names == [
        "temperature", "vibration", "pressure", "rpm", "power_consumption",
        "temp_vib_ratio", "power_per_rpm", "pressure_per_rpm",
        "temp_squared", "vib_squared",
        "temperature_zscore", "vibration_zscore", "pressure_zscore",
        "rpm_zscore", "power_consumption_zscore",
    ]
    # engineered frame emits identical columns in identical order
    prep, zst = _fit()
    frame = engineer_features(prep.transform_one(VALID), zscore_stats=zst)
    assert list(frame.columns) == names
    assert len(names) == 15


# ---------------------------------------------------------------------------
# Deterministic missing / invalid handling
# ---------------------------------------------------------------------------

def test_fitted_imputation_is_deterministic():
    records = [
        {"temperature": 75, "vibration": 0.5, "pressure": 30, "rpm": 1500, "power_consumption": 100},
        {"temperature": 80, "vibration": 0.6, "pressure": 31, "rpm": 1520, "power_consumption": 105},
        {"temperature": 70, "pressure": 29, "rpm": 1480, "power_consumption": 95},  # missing vibration
        {"temperature": 85, "vibration": 0.7, "pressure": 32, "rpm": 1490, "power_consumption": 110},
    ]
    prep = FittedPreprocessor.fit(records)
    expected = np.median([0.5, 0.6, 0.7])  # fitted median of non-null vibration
    single = prep.transform_one(records[2])
    assert float(single["vibration"].iloc[0]) == pytest.approx(expected)


def test_invalid_input_handled_per_contract():
    records = _batch()
    prep, _ = _fit()
    bad = {"temperature": 9999.0, "vibration": -5.0, "pressure": "not-a-number",
           "rpm": 1500.0, "power_consumption": 100.0}
    out = prep.transform_one(bad)
    # out-of-range + unparseable values nulled, then filled with fitted medians
    assert np.isfinite(out.values).all()
    medians = np.median([r["temperature"] for r in records])
    assert float(out["temperature"].iloc[0]) == pytest.approx(medians)


# ---------------------------------------------------------------------------
# Zero-denominator safety
# ---------------------------------------------------------------------------

def test_zero_denominator_no_inf_or_nan():
    prep, zst = _fit()
    zero_row = {"temperature": 80, "vibration": 0.0, "pressure": 31,
                "rpm": 0.0, "power_consumption": 105}
    feat = engineer_features(prep.transform_one(zero_row), zscore_stats=zst)
    assert np.isfinite(feat.values).all()


# ---------------------------------------------------------------------------
# Full pipeline on a representative valid row
# ---------------------------------------------------------------------------

def test_full_pipeline_valid_row():
    prep, zst = _fit()
    feat = engineer_features(prep.transform_one(VALID), zscore_stats=zst).iloc[0]
    assert len(feat) == 15
    assert np.isfinite(feat.values).all()
    assert set(feat.index) == set(get_feature_names())


# ---------------------------------------------------------------------------
# Train/serve consistency (no skew)
# ---------------------------------------------------------------------------

def test_train_serve_consistency_batch_vs_single():
    """Same reading through the batch path and the single-row path must yield
    the identical feature vector when using the same fitted state."""
    prep, zst = _fit()
    batch = engineer_features(prep.transform(_batch()), zscore_stats=zst)
    for i, rec in enumerate(_batch()):
        single = engineer_features(prep.transform_one(rec), zscore_stats=zst).iloc[0].values
        assert np.allclose(single, batch.iloc[i].values), f"row {i} skew"


def test_train_serve_consistency_missing_value():
    """A row with a missing value must impute to the fitted median identically
    whether processed in batch or alone."""
    records = _batch()
    missing_row = {"temperature": 73, "pressure": 30, "rpm": 1500, "power_consumption": 100}
    prep = FittedPreprocessor.fit(records + [missing_row])
    zst = fit_zscore_stats(prep.transform(records + [missing_row]))
    batch = engineer_features(prep.transform([missing_row]), zscore_stats=zst).iloc[0].values
    single = engineer_features(prep.transform_one(missing_row), zscore_stats=zst).iloc[0].values
    assert np.allclose(batch, single)


# ---------------------------------------------------------------------------
# Training script mapping
# ---------------------------------------------------------------------------

def test_train_script_maps_all_columns_and_labels():
    from scripts.train_models import prepare_records
    df = pd.read_csv(DATASET_PATH)
    recs, labels = prepare_records(df)
    assert set(recs[0].keys()) == set(contract.SENSOR_COLUMNS)
    assert len(labels) == len(df)
    assert sum(labels) == int(df[contract.TARGET_COLUMN].sum())
    # all five canonical channels resolved from real data (not defaulted)
    assert all(recs[0].get(c) is not None for c in contract.SENSOR_COLUMNS)
    # explicit mapping value check: rotation_speed -> rpm, active_power -> power
    assert recs[0]["rpm"] == df.iloc[0]["rotation_speed"]
    assert recs[0]["power_consumption"] == df.iloc[0]["active_power"]