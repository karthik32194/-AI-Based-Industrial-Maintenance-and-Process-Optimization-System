
"""Preprocessing for the 15-sensor industrial dataset.

The production preprocessing must use the same sensor names and units as the
training dataset. Training-time medians are persisted with the model and are
reused for single-reading inference so that inference never computes a
one-row median or z-score from the current batch.
"""
from __future__ import annotations

from datetime import datetime
import numpy as np
import pandas as pd

from app.core.logging import get_logger

logger = get_logger(__name__)

SENSOR_COLUMNS = [
    "temperature", "vibration", "pressure", "humidity", "rotation_speed",
    "voltage", "current", "oil_level", "load", "motor_temperature",
    "gearbox_temperature", "sound_level", "fan_speed", "reactive_power",
    "active_power",
]

# Broad operational validation limits. They are validation guards, not failure
# thresholds. The model learns failure risk from the dataset.
SENSOR_BOUNDS: dict[str, tuple[float, float]] = {
    "temperature": (-50.0, 500.0),
    "vibration": (0.0, 100.0),
    "pressure": (0.0, 1000.0),
    "humidity": (0.0, 100.0),
    "rotation_speed": (0.0, 100_000.0),
    "voltage": (0.0, 10_000.0),
    "current": (0.0, 1_000.0),
    "oil_level": (0.0, 100.0),
    "load": (0.0, 10_000.0),
    "motor_temperature": (-50.0, 500.0),
    "gearbox_temperature": (-50.0, 500.0),
    "sound_level": (0.0, 200.0),
    "fan_speed": (0.0, 100_000.0),
    "reactive_power": (0.0, 10_000.0),
    "active_power": (0.0, 10_000.0),
}

TIME_COLUMNS = ["hour", "day", "month", "day_of_week"]


def validate_reading(data: dict) -> dict:
    """Validate sensor values; invalid/out-of-range values become None."""
    cleaned = dict(data)

    # Backward-compatible aliases used by the existing frontend/API.
    # The real dataset names are rotation_speed and active_power.
    if cleaned.get("rotation_speed") is None and cleaned.get("rpm") is not None:
        cleaned["rotation_speed"] = cleaned["rpm"]
    if cleaned.get("active_power") is None and cleaned.get("power_consumption") is not None:
        cleaned["active_power"] = cleaned["power_consumption"]

    for col, (lo, hi) in SENSOR_BOUNDS.items():
        val = cleaned.get(col)
        if val is None:
            continue
        try:
            val = float(val)
        except (TypeError, ValueError):
            cleaned[col] = None
            continue
        if not (lo <= val <= hi):
            logger.warning("sensor_value_out_of_range", column=col, value=val)
            cleaned[col] = None
        else:
            cleaned[col] = val
    return cleaned


def fit_imputation_values(records: list[dict]) -> dict[str, float]:
    """Calculate training medians for stable production imputation."""
    df = pd.DataFrame(records)
    medians: dict[str, float] = {}
    for col in SENSOR_COLUMNS:
        if col not in df.columns:
            medians[col] = 0.0
            continue
        values = pd.to_numeric(df[col], errors="coerce")
        # Apply validation bounds before calculating medians.
        lo, hi = SENSOR_BOUNDS[col]
        values = values.where(values.between(lo, hi))
        median = values.median()
        medians[col] = float(median) if pd.notna(median) else 0.0
    return medians


def preprocess_sensor_data(
    records: list[dict],
    imputation_values: dict[str, float] | None = None,
) -> pd.DataFrame:
    """Clean sensor records and return the 15 model sensor columns."""
    if not records:
        return pd.DataFrame(columns=SENSOR_COLUMNS)

    df = pd.DataFrame(records).copy()
    for col in SENSOR_COLUMNS:
        if col not in df.columns:
            df[col] = np.nan
        df[col] = pd.to_numeric(df[col], errors="coerce")

    for col, (lo, hi) in SENSOR_BOUNDS.items():
        mask = (df[col] < lo) | (df[col] > hi)
        if mask.any():
            logger.warning("invalid_readings_nulled", column=col, count=int(mask.sum()))
            df.loc[mask, col] = np.nan

    if imputation_values is None:
        imputation_values = fit_imputation_values(records)

    for col in SENSOR_COLUMNS:
        fill_value = float(imputation_values.get(col, 0.0))
        df[col] = df[col].fillna(fill_value)

    return df[SENSOR_COLUMNS].astype(float)


def extract_time_features(records: list[dict]) -> pd.DataFrame:
    """Extract the exact four time features used by the notebook."""
    timestamps = []
    for record in records:
        ts = record.get("timestamp")
        if ts is None:
            ts = datetime.utcnow()
        ts = pd.to_datetime(ts, errors="coerce")
        if pd.isna(ts):
            ts = pd.Timestamp.utcnow()
        timestamps.append(ts)
    ts = pd.Series(timestamps)
    return pd.DataFrame({
        "hour": ts.dt.hour.astype(float),
        "day": ts.dt.day.astype(float),
        "month": ts.dt.month.astype(float),
        "day_of_week": ts.dt.dayofweek.astype(float),
    })


def build_prediction_features(
    records: list[dict],
    imputation_values: dict[str, float] | None = None,
) -> pd.DataFrame:
    """Build the 19 columns used by the XGBoost notebook model."""
    sensors = preprocess_sensor_data(records, imputation_values)
    time_features = extract_time_features(records)
    return pd.concat([sensors.reset_index(drop=True), time_features], axis=1)


def preprocess_single(reading: dict, imputation_values: dict[str, float] | None = None) -> pd.DataFrame:
    """Backward-compatible helper returning one cleaned sensor row."""
    return preprocess_sensor_data([validate_reading(reading)], imputation_values)
