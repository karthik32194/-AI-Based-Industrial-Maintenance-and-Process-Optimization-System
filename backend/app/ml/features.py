"""
Feature engineering — Section 16 (engineer_features)
Derives statistical and ratio features from sensor readings.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from app.ml.preprocessing import SENSOR_COLUMNS


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Generate ML features from a preprocessed sensor DataFrame.

    Features produced:
    - Original 5 sensor channels (pass-through)
    - temp_vib_ratio    : temperature / (vibration + ε)
    - power_per_rpm     : power_consumption / (rpm + ε)
    - pressure_per_rpm  : pressure / (rpm + ε)
    - sensor_zscore_*   : z-scores for each channel (multi-row only)
    - temp_squared      : captures non-linear temperature effects
    - vib_squared       : captures non-linear vibration effects

    For single-row inference, z-score features are set to 0 (no variance).
    """
    feat = df[SENSOR_COLUMNS].copy()
    eps = 1e-6

    # Ratio features
    feat["temp_vib_ratio"] = feat["temperature"] / (feat["vibration"] + eps)
    feat["power_per_rpm"] = feat["power_consumption"] / (feat["rpm"] + eps)
    feat["pressure_per_rpm"] = feat["pressure"] / (feat["rpm"] + eps)

    # Non-linear features
    feat["temp_squared"] = feat["temperature"] ** 2
    feat["vib_squared"] = feat["vibration"] ** 2

    # Z-score features — meaningful only for batches
    for col in SENSOR_COLUMNS:
        std = feat[col].std()
        mean = feat[col].mean()
        if std > eps:
            feat[f"{col}_zscore"] = (feat[col] - mean) / std
        else:
            feat[f"{col}_zscore"] = 0.0

    return feat


def get_feature_names() -> list[str]:
    """Return the ordered list of feature column names produced by engineer_features."""
    base = list(SENSOR_COLUMNS)
    derived = [
        "temp_vib_ratio", "power_per_rpm", "pressure_per_rpm",
        "temp_squared", "vib_squared",
    ]
    zscores = [f"{col}_zscore" for col in SENSOR_COLUMNS]
    return base + derived + zscores
