"""
ML preprocessing pipeline -- Section 16 (preprocess_sensor_data).

Cleans raw sensor readings: coercs to numeric, flags out-of-range values,
imputes missing values. Imputation is deterministic.

Two modes:
  * Stateless helpers (``preprocess_sensor_data``, ``preprocess_single``) keep
    the legacy call surface. They impute per-call (median of the supplied
    batch), which is fine for one-off use.
  * ``FittedPreprocessor`` is the Phase 1 contract path. Median statistics are
    learned ONCE on training data and reused verbatim for batch training AND
    single-row inference. This removes train/serve skew in imputation.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from app.core.logging import get_logger
from app.ml.contract import SENSOR_BOUNDS, SENSOR_COLUMNS

logger = get_logger(__name__)

# Re-export canonical column names / bounds so existing callers
# (features.py, tests) keep working against the single source of truth.
SENSOR_COLUMNS = SENSOR_COLUMNS
SENSOR_BOUNDS = SENSOR_BOUNDS


# ---------------------------------------------------------------------------
# Core clean/impute primitives
# ---------------------------------------------------------------------------

def _validate_coerce(records: list[dict], columns: list[str],
                     bounds: dict[str, tuple[float, float]]) -> pd.DataFrame:
    """Coerce to numeric and null out-of-range values. NO imputation.

    ``columns`` selects and orders the output. ``bounds`` is an optional
    {column: (lo, hi)} map; only columns present in ``bounds`` are range-checked
    (a column with no scientific bounds is left untouched numerically).
    """
    df = pd.DataFrame(records)
    for col in columns:
        if col not in df.columns:
            df[col] = np.nan
    df[columns] = df[columns].apply(pd.to_numeric, errors="coerce")

    for col, (lo, hi) in bounds.items():
        if col not in columns:
            continue
        mask = (df[col] < lo) | (df[col] > hi)
        if mask.any():
            logger.warning("invalid_readings_nulled", column=col, count=int(mask.sum()))
        df.loc[mask, col] = np.nan
    return df[columns]


def _column_medians(df: pd.DataFrame, columns: list[str]) -> dict[str, float]:
    """Per-column median, falling back to 0.0 for an all-NaN column."""
    medians: dict[str, float] = {}
    for col in columns:
        m = df[col].median()
        medians[col] = float(m) if not np.isnan(m) else 0.0
    return medians


def _impute(df: pd.DataFrame, medians: dict[str, float], columns: list[str]) -> pd.DataFrame:
    """Fill remaining NaN with the given per-column medians."""
    df = df.copy()
    for col in columns:
        if df[col].isna().any():
            df[col] = df[col].fillna(medians.get(col, 0.0))
    return df[columns]


# ---------------------------------------------------------------------------
# Fitted preprocessor (Phase 1 contract path, train/serve consistent)
# ---------------------------------------------------------------------------

class FittedPreprocessor:
    """
    Preprocessor whose imputation statistics are learned at fit time and
    reused for both batch transform and single-row inference.

    Deterministic: the same reading yields the same output whether processed
    in a batch alongside training data or alone at inference time.

    Phase 3: the preprocessor generalises to an arbitrary ordered ``columns``
    list (e.g. the 15-variable anomaly representation) with an optional
    ``bounds`` envelope. Defaults preserve the Phase 1 5-channel canonical
    behaviour.
    """

    def __init__(self, medians: dict[str, float], columns: list[str] | None = None):
        self.medians: dict[str, float] = dict(medians)
        # Column order is pinned; infer from medians key order when not given so
        # reloaded (pickled) states remain self-describing.
        self.columns: list[str] = list(columns) if columns is not None else list(medians.keys())

    @classmethod
    def fit(cls, records: list[dict], columns: list[str] | None = None,
            bounds: dict[str, tuple[float, float]] | None = None) -> "FittedPreprocessor":
        """Learn per-column medians from records (after validation/coerce)."""
        columns = list(columns) if columns is not None else SENSOR_COLUMNS
        bounds = bounds if bounds is not None else SENSOR_BOUNDS
        clean = _validate_coerce(records, columns, bounds)
        return cls(_column_medians(clean, columns), columns=columns)

    def transform(self, records: list[dict], bounds: dict[str, tuple[float, float]] | None = None) -> pd.DataFrame:
        """Preprocess records using fitted medians and this preprocessor's columns."""
        bounds = bounds if bounds is not None else SENSOR_BOUNDS
        clean = _validate_coerce(records, self.columns, bounds)
        return _impute(clean, self.medians, self.columns)

    def transform_one(self, reading: dict, bounds: dict[str, tuple[float, float]] | None = None) -> pd.DataFrame:
        """Preprocess a single reading. One-row DataFrame, fitted medians."""
        return self.transform([reading], bounds=bounds)

    def to_dict(self) -> dict[str, float]:
        return dict(self.medians)

    @classmethod
    def from_dict(cls, data: dict[str, float]) -> "FittedPreprocessor":
        return cls(dict(data))


# ---------------------------------------------------------------------------
# Fitted feature statistics for z-scores (train/serve consistent)
# ---------------------------------------------------------------------------

class PipelineState:
    """
    Bundles the fitted preprocessing + feature statistics shared by training
    and inference. Persisted to disk alongside trained models so a fresh
    process at serving time reproduces the exact training transformation.
    """

    def __init__(self, preprocessor: FittedPreprocessor, zscore_stats: dict[str, Any] | None = None):
        self.preprocessor = preprocessor
        self.zscore_stats: dict[str, Any] = dict(zscore_stats or {})

    def to_dict(self) -> dict[str, Any]:
        return {"preprocessor": self.preprocessor.to_dict(), "zscore_stats": dict(self.zscore_stats)}

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "PipelineState":
        return cls(
            preprocessor=FittedPreprocessor.from_dict(data["preprocessor"]),
            zscore_stats=data.get("zscore_stats", {}),
        )


def save_pipeline_state(state: PipelineState, path: Path | str) -> None:
    """Persist fitted pipeline state to disk (pickle)."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    import pickle
    with open(path, "wb") as f:
        pickle.dump(state.to_dict(), f)
    logger.info("pipeline_state_saved", path=str(path))


def load_pipeline_state(path: Path | str) -> PipelineState | None:
    """Load fitted pipeline state from disk, or None if absent."""
    path = Path(path)
    if not path.exists():
        return None
    import pickle
    with open(path, "rb") as f:
        data = pickle.load(f)
    state = PipelineState.from_dict(data)
    logger.info("pipeline_state_loaded", path=str(path))
    return state


# ---------------------------------------------------------------------------
# Legacy stateless helpers (call surface preserved)
# ---------------------------------------------------------------------------

def validate_reading(data: dict) -> dict:
    """
    Validate a single sensor reading dict.
    Returns the same dict with out-of-range values set to None.
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
    Stateless preprocessing: coerce, null out-of-range, impute per-call median.
    Preferred path is :class:`FittedPreprocessor`; this exists for callers that
    do not carry fitted state (e.g. ad-hoc analysis).
    """
    if not records:
        return pd.DataFrame(columns=SENSOR_COLUMNS)
    clean = _validate_coerce(records, SENSOR_COLUMNS, SENSOR_BOUNDS)
    return _impute(clean, _column_medians(clean, SENSOR_COLUMNS), SENSOR_COLUMNS)


def preprocess_single(reading: dict) -> pd.DataFrame:
    """
    Stateless preprocess of one reading. Returns a one-row DataFrame.
    Note: without fitted state, a missing value is filled with the median of
    the single row (or 0.0). Use :class:`FittedPreprocessor` for serving.
    """
    validated = validate_reading(reading)
    return preprocess_sensor_data([validated])