"""
Feature engineering -- Section 16 (engineer_features).

Derives statistical and ratio features from preprocessed sensor readings.

Feature contract (order fixed by :func:`get_feature_names`):
  * 5 pass-through sensor channels
  * 3 ratio features (eps-guarded, no division-by-zero)
  * 2 squared features
  * 5 z-score features

Z-score features are the train/serve hazard: if computed inline per batch,
single-row inference (std of one value == NaN) silently produces all-zero
z-scores that differ from training. The Phase 1 contract path computes z-scores
from *fitted* per-column mean/std (``zscore_stats``) learned once on training
data and reused at inference. ``engineer_features`` still falls back to inline
batch statistics when no stats are supplied, for legacy/analysis use.
"""
from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from app.ml.preprocessing import SENSOR_COLUMNS

EPS = 1e-6

# Derived feature names (stable, in output order).
DERIVED_RATIO_FEATURES = ["temp_vib_ratio", "power_per_rpm", "pressure_per_rpm"]
DERIVED_SQUARED_FEATURES = ["temp_squared", "vib_squared"]
ZSCORE_SUFFIX = "_zscore"


def _all_feature_names() -> list[str]:
    base = list(SENSOR_COLUMNS)
    derived = DERIVED_RATIO_FEATURES + DERIVED_SQUARED_FEATURES
    zscores = [f"{c}{ZSCORE_SUFFIX}" for c in SENSOR_COLUMNS]
    return base + derived + zscores


def get_feature_names() -> list[str]:
    """Ordered list of outputs of :func:`engineer_features`."""
    return _all_feature_names()


def fit_zscore_stats(preprocessed_df: pd.DataFrame) -> dict[str, tuple[float, float]]:
    """
    Learn per-channel (mean, std) from a preprocessed training DataFrame.
    Zero-variance channels store (0.0, 0.0); the feature builder guards
    std <= EPS by emitting 0.0 for that z-score.
    """
    stats: dict[str, tuple[float, float]] = {}
    for col in SENSOR_COLUMNS:
        std = float(preprocessed_df[col].std())
        mean = float(preprocessed_df[col].mean())
        stats[col] = (mean, std)
    return stats


def engineer_features(df: pd.DataFrame, zscore_stats: dict[str, Any] | None = None) -> pd.DataFrame:
    """
    Generate ML features from a preprocessed sensor DataFrame.

    Args:
        df:            Preprocessed DataFrame (``FittedPreprocessor.transform``
                       output or raw canonical columns).
        zscore_stats:  Optional fitted {channel: (mean, std)}. When provided,
                       z-scores are computed from these (train/serve consistent).
                       When omitted, z-scores use the supplied batch's own
                       mean/std (legacy/analysis path; single-row callers will
                       get 0.0 z-scores).

    Ratio denominators are eps-guarded so no feature can be inf/NaN from a zero
    or missing input.
    """
    feat = df[SENSOR_COLUMNS].copy()

    # Ratio features (eps-guarded)
    feat["temp_vib_ratio"] = feat["temperature"] / (feat["vibration"] + EPS)
    feat["power_per_rpm"] = feat["power_consumption"] / (feat["rpm"] + EPS)
    feat["pressure_per_rpm"] = feat["pressure"] / (feat["rpm"] + EPS)

    # Non-linear features
    feat["temp_squared"] = feat["temperature"] ** 2
    feat["vib_squared"] = feat["vibration"] ** 2

    # Z-score features
    for col in SENSOR_COLUMNS:
        if zscore_stats is not None and col in zscore_stats:
            mean, std = zscore_stats[col]
            std = float(std)
            if std > EPS:
                feat[f"{col}_zscore"] = (feat[col] - mean) / std
            else:
                feat[f"{col}_zscore"] = 0.0
        else:
            std = feat[col].std()
            mean = feat[col].mean()
            if not np.isnan(std) and std > EPS:
                feat[f"{col}_zscore"] = (feat[col] - mean) / std
            else:
                feat[f"{col}_zscore"] = 0.0

    return feat[SENSOR_COLUMNS + DERIVED_RATIO_FEATURES + DERIVED_SQUARED_FEATURES
                + [f"{c}{ZSCORE_SUFFIX}" for c in SENSOR_COLUMNS]]