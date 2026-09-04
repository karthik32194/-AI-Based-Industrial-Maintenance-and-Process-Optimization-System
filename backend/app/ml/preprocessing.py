"""
ML preprocessing pipeline — Section 16 (preprocess_sensor_data)
Cleans raw sensor readings, handles missing/invalid values.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from app.core.logging import get_logger

logger = get_logger(__name__)

# Operational thresholds — readings outside these bounds are flagged invalid
SENSOR_BOUNDS: dict[str, tuple[float, float]] = {
    "temperature": (-50.0, 500.0),
    "vibration": (0.0, 100.0),
    "pressure": (0.0, 1000.0),
    "rpm": (0.0, 100_000.0),
    "power_consumption": (0.0, 10_000.0),
}

SENSOR_COLUMNS = list(SENSOR_BOUNDS.keys())


def validate_reading(data: dict) -> dict:
    """
    Validate a single sensor reading dict.
    Returns the same dict with out-of-range values set to NaN.
    """
    cleaned = dict(data)
    for col, (lo, hi) in SENSOR_BOUNDS.items():
        val = cleaned.get(col)
        if val is not None and not (lo <= val <= hi):
            logger.warning("sensor_value_out_of_range", column=col, value=val)
            cleaned[col] = None
    return cleaned


def preprocess_sensor_data(records: list[dict]) -> pd.DataFrame:
    """
    Convert a list of sensor reading dicts into a clean DataFrame.

    Steps:
    1. Build DataFrame from records.
    2. Coerce columns to float.
    3. Flag and null out-of-range values.
    4. Impute missing values with column median (robust to outliers).
    5. Return cleaned DataFrame.
    """
    if not records:
        return pd.DataFrame(columns=SENSOR_COLUMNS)

    df = pd.DataFrame(records)

    # Ensure all sensor columns are present
    for col in SENSOR_COLUMNS:
        if col not in df.columns:
            df[col] = np.nan

    df[SENSOR_COLUMNS] = df[SENSOR_COLUMNS].apply(pd.to_numeric, errors="coerce")

    # Flag out-of-range values as NaN
    for col, (lo, hi) in SENSOR_BOUNDS.items():
        mask = (df[col] < lo) | (df[col] > hi)
        if mask.any():
            logger.warning("invalid_readings_nulled", column=col, count=int(mask.sum()))
        df.loc[mask, col] = np.nan

    # Impute missing with column median
    for col in SENSOR_COLUMNS:
        if df[col].isna().any():
            median_val = df[col].median()
            fill_val = median_val if not np.isnan(median_val) else 0.0
            df[col] = df[col].fillna(fill_val)
            logger.debug("missing_values_imputed", column=col, fill_value=fill_val)

    return df[SENSOR_COLUMNS]


def preprocess_single(reading: dict) -> pd.DataFrame:
    """
    Preprocess a single sensor reading for inference.
    Returns a one-row DataFrame ready for feature engineering.
    """
    validated = validate_reading(reading)
    return preprocess_sensor_data([validated])
