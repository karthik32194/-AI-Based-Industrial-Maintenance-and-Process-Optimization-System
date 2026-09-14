
"""Feature definitions shared by training and inference.

The notebook's supervised XGBoost model uses the 15 sensor columns plus four
calendar features extracted from timestamp, for a total of 19 features.
"""
from __future__ import annotations

from app.ml.preprocessing import SENSOR_COLUMNS, TIME_COLUMNS

FAILURE_FEATURE_COLUMNS = SENSOR_COLUMNS + TIME_COLUMNS


def get_feature_names() -> list[str]:
    """Return the exact ordered feature list expected by XGBoost."""
    return list(FAILURE_FEATURE_COLUMNS)


def engineer_features(df):
    """Compatibility wrapper: the validated model uses the raw 19 columns."""
    expected = get_feature_names()
    result = df.copy()
    for col in expected:
        if col not in result.columns:
            result[col] = 0.0
    return result[expected]
