"""
Phase 1 -- ML data contract.

Single authoritative definition of the ML input schema for this subsystem.
All ML pipeline code (preprocessing, feature engineering, training, inference)
shall read its column names and roles from this module. Do not hard-code
column names in two places.

Evidence base: ``simulated_iiot_dataset.csv`` (1000 rows, 17 columns) and the
existing ML modules. See report for provenance limits.
"""
from __future__ import annotations

# ---------------------------------------------------------------------------
# Canonical ML input columns (fixed order).
# These are the five fields the ML subsystem actually consumes. The dataset
# uses different labels for two of them; the explicit mapping below resolves
# that. Never rename silently -- the map is the contract.
# ---------------------------------------------------------------------------
SENSOR_COLUMNS: list[str] = [
    "temperature",       # °C
    "vibration",         # mm/s (dataset scale ~0.2-0.8)
    "pressure",          # bar  (dataset scale ~20-42)
    "rpm",               # rotations/min (dataset field: rotation_speed)
    "power_consumption",  # kW   (dataset field: active_power)
]

# Ordered alias kept for callers of the old module surface.
ORDERED_SENSOR_COLUMNS: list[str] = SENSOR_COLUMNS

# Raw sensor names exactly as they appear in the CSV (subset used by ML).
SENSOR_COLUMNS_RAW: list[str] = [
    "temperature",
    "vibration",
    "pressure",
    "rotation_speed",
    "active_power",
]


# ---------------------------------------------------------------------------
# Supervised target
# ---------------------------------------------------------------------------
TARGET_COLUMN: str = "machine_failure"
# Label semantics: 1 = machine failure event, 0 = normal. Exact physical
# meaning of a "failure" is not documented in the repository; see report
# (class D -- UNKNOWN/UNVERIFIED).


# ---------------------------------------------------------------------------
# Temporal / metadata fields present in the dataset
# ---------------------------------------------------------------------------
TEMPORAL_COLUMNS: list[str] = ["timestamp"]
# Excluded from the ML feature vector. Not numeric features.

# Dataset columns that are present but NOT currently part of the ML input
# contract. Adding them to a feature vector is a Phase 2 model-selection /
# architecture decision, outside the Phase 1 contract.
DATASET_EXCLUDED_FROM_CONTRACT: list[str] = [
    "humidity",
    "voltage",
    "current",
    "oil_level",
    "load",
    "motor_temperature",
    "gearbox_temperature",
    "sound_level",
    "fan_speed",
    "reactive_power",
]

# Full observed dataset column set (source of truth from the CSV).
DATASET_COLUMNS: list[str] = (
    SENSOR_COLUMNS_RAW + [TARGET_COLUMN] + TEMPORAL_COLUMNS + DATASET_EXCLUDED_FROM_CONTRACT
)

# Phase 3 -- anomaly-detection feature representation.
# Phase 2 selected ALL 15 raw industrial variables as the final representation
# for the predictive-maintenance system; anomaly detection uses the same 15 so
# normal/abnormal multivariate state is judged on the complete observable state.
# Plain dataset column names (no canonical rename). Order is pinned for the
# anomaly feature vector. No scientific operating bounds exist for these raw
# variables, so anomaly preprocessing imputes medians only (no range nulling).
ANOMALY_SENSOR_COLUMNS: list[str] = [
    "temperature",
    "vibration",
    "pressure",
    "humidity",
    "rotation_speed",
    "voltage",
    "current",
    "oil_level",
    "load",
    "motor_temperature",
    "gearbox_temperature",
    "sound_level",
    "fan_speed",
    "reactive_power",
    "active_power",
]

# Phase 4 -- failure-risk prediction feature representation.
# Phase 2 selected ALL 15 raw industrial variables as the final representation for
# the final supervised failure model. Phase-1 engineered features (ratios, squares,
# z-scores) were rejected for this model (no meaningful gain; superseded). The 15
# variables are plain dataset names (no canonical rename). Order is pinned for the
# failure feature vector. The same 15 variables feed anomaly detection (Phase 3),
# so normal/abnormal multivariate state and failure-risk share the observable state.
FAILURE_SENSOR_COLUMNS: list[str] = list(ANOMALY_SENSOR_COLUMNS)


# ---------------------------------------------------------------------------
# Dataset column -> canonical ML column mapping
# ---------------------------------------------------------------------------
DATASET_TO_CANONICAL: dict[str, str] = {
    "temperature": "temperature",
    "vibration": "vibration",
    "pressure": "pressure",
    "rotation_speed": "rpm",
    "active_power": "power_consumption",
}
CANONICAL_TO_DATASET: dict[str, str] = {v: k for k, v in DATASET_TO_CANONICAL.items()}


def map_dataset_to_canonical(dataset_columns: list[str]) -> dict[str, str]:
    """
    Return {dataset_col: canonical_col} for the given dataset column names,
    for the subset that participates in the ML contract.

    Unknown columns are ignored; every canonical sensor column must map.
    """
    mapping: dict[str, str] = {}
    for col in dataset_columns:
        norm = col.strip().lower()
        if norm in DATASET_TO_CANONICAL:
            mapping[col] = DATASET_TO_CANONICAL[norm]
    return mapping


# ---------------------------------------------------------------------------
# Operational validation bounds (preprocessing).
# Values outside these envelopes are flagged invalid and nulled before
# imputation. NOTE (report, class D): these ranges are NOT derived from the
# dataset -- they are generous operational envelopes. The observed dataset
# ranges are much tighter (e.g. vibration 0.2-0.8, temperature 58-94). Tighten
# or re-derive them as a Phase 2 validation-policy decision. Do not treat them
# as scientifically calibrated.
# ---------------------------------------------------------------------------
SENSOR_BOUNDS: dict[str, tuple[float, float]] = {
    "temperature": (-50.0, 500.0),
    "vibration": (0.0, 100.0),
    "pressure": (0.0, 1000.0),
    "rpm": (0.0, 100_000.0),
    "power_consumption": (0.0, 10_000.0),
}