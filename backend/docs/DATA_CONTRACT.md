# ML Data Contract — Phase 1

> **STATUS (Phase 4/5 update):** This document is the **Phase 1** 5-channel contract.
> The **final, active ML representation is the 15 raw industrial variables**
> (`FAILURE_SENSOR_COLUMNS` = `ANOMALY_SENSOR_COLUMNS` in `app/ml/contract.py`).
> The 5-channel `SENSOR_COLUMNS` below is the ingest/storage canonical subset only;
> the 10 "Excluded from ML (Phase 2)" dataset columns **are** in the final feature
> vector. The Phase-1 engineered path (§5–§6: ratios, squares, z-scores, `PipelineState`)
> is **superseded** — the final models consume the 15 raw variables directly with
> artifact-carried fitted median imputation only (no scaling, no engineered
> features), and `predict_failure`/`detect_anomaly` load the Phase 3/4 artifacts,
> not a `PipelineState`. Sections below are retained as history unless noted.

Single authoritative definition for ML subsystem.
Source of truth: `app/ml/contract.py`. Do not duplicate column names elsewhere.

## 1. Dataset

File: `simulated_iiot_dataset.csv` — 1000 rows, 17 columns, 0 nulls, no duplicate rows or timestamps.

| Column | Role | Datatype | Handling |
|---|---|---|---|
| temperature | SENSOR input | float64 | Coerced numeric, bounds-checked, median-imputed |
| vibration | SENSOR input | float64 | Coerced numeric, bounds-checked, median-imputed |
| pressure | SENSOR input | float64 | Coerced numeric, bounds-checked, median-imputed |
| rotation_speed | SENSOR raw (maps to `rpm`) | float64 | Mapped via `DATASET_TO_CANONICAL`, then as `rpm` |
| active_power | SENSOR raw (maps to `power_consumption`) | float64 | Mapped via `DATASET_TO_CANONICAL`, then as `power_consumption` |
| humidity | Excluded from ML (Phase 2) | float64 | Present in dataset, not in feature vector |
| voltage | Excluded from ML (Phase 2) | float64 | Present in dataset, not in feature vector |
| current | Excluded from ML (Phase 2) | float64 | Present in dataset, not in feature vector |
| oil_level | Excluded from ML (Phase 2) | float64 | Present in dataset, not in feature vector |
| load | Excluded from ML (Phase 2) | float64 | Present in dataset, not in feature vector |
| motor_temperature | Excluded from ML (Phase 2) | float64 | Present in dataset, not in feature vector |
| gearbox_temperature | Excluded from ML (Phase 2) | float64 | Present in dataset, not in feature vector |
| sound_level | Excluded from ML (Phase 2) | float64 | Present in dataset, not in feature vector |
| fan_speed | Excluded from ML (Phase 2) | float64 | Present in dataset, not in feature vector |
| reactive_power | Excluded from ML (Phase 2) | float64 | Present in dataset, not in feature vector |
| machine_failure | TARGET | int64 (0/1) | 0=normal, 1=failure; exact physical meaning UNVERIFIED (see §3) |
| timestamp | METADATA / temporal | object (parseable datetime, hourly) | Excluded from feature vector; ordering not strictly monotonic in raw file |

Distribution: `machine_failure` 0=838, 1=162 (16.2% positive). Timestamps hourly from 1/1/2024, no duplicates.

## 2. Canonical ML Schema

Canonical sensor order (fixed, `SENSOR_COLUMNS`):

```
temperature, vibration, pressure, rpm, power_consumption
```

- `TARGET_COLUMN = "machine_failure"`
- `TEMPORAL_COLUMNS = ["timestamp"]`
- `DATASET_EXCLUDED_FROM_CONTRACT` = 10 columns above (available, not in contract).
- `DATASET_TO_CANONICAL = {"temperature":"temperature","vibration":"vibration","pressure":"pressure","rotation_speed":"rpm","active_power":"power_consumption"}`

Prefer dataset column names except `rpm`/`power_consumption` where strong implementation reason (DB, API, persisted models) justifies normalization — mapping is explicit.

## 3. Target Definition

`machine_failure` — binary label. `1` denotes a machine failure event, `0` normal. No repository documentation establishes the exact physical failure mode, labeling criteria, or collection protocol. Treat semantics as UNVERIFIED (class D). Do not assume bearing/thermal/etc. Do not fabricate lineage from UCI dataset.

## 4. Preprocessing Contract

Raw input (canonical dict or dataset row after mapping) → validation → feature-ready frame.

```
raw dict(s)                # canonical keys
  → coerce to numeric (errors→NaN)
  → out-of-range → NaN (SENSOR_BOUNDS)
  → impute NaN with per-column median
  → ordered canonical DataFrame [SENSOR_COLUMNS]
```

- `SENSOR_BOUNDS` (from contract): generous operational envelopes, NOT calibrated to dataset (dataset ranges much tighter). Flagged as Phase 2 validation-policy decision (class D).
- Single source: `app/ml/contract.py` defines bounds; `preprocessing.py` imports them (re-exported for compatibility).
- Two modes:
  - Stateless helpers `preprocess_sensor_data` / `preprocess_single` — median computed per-call (legacy/analysis). Kept for compatibility.
  - **Contract path** `FittedPreprocessor.fit(records)` → `FittedPreprocessor.transform` / `transform_one` — medians learned once on training data, persisted in `PipelineState`, reused at inference. This is the train/serve-consistent path.

Handling:
- Missing/None/NaN → filled with fitted median (deterministic).
- Non-numeric strings → coerced to NaN → same.
- All-NaN column → median fallback 0.0.
- Out-of-range values → nulled → same imputation.
- Empty input → empty DataFrame with canonical columns.

## 5. Feature Engineering Contract

`engineer_features(df, zscore_stats=None)` — `df` is output of preprocessing.

Final 15 features (fixed order, `get_feature_names()`):

| Feature | Origin |
|---|---|
| temperature, vibration, pressure, rpm, power_consumption | pass-through canonical inputs |
| temp_vib_ratio = temperature / (vibration + 1e-6) | ratio, eps-guarded |
| power_per_rpm = power_consumption / (rpm + 1e-6) | ratio, eps-guarded |
| pressure_per_rpm = pressure / (rpm + 1e-6) | ratio, eps-guarded |
| temp_squared = temperature² | non-linear |
| vib_squared = vibration² | non-linear |
| temperature_zscore, vibration_zscore, pressure_zscore, rpm_zscore, power_consumption_zscore | z-scores (see below) |

- Zero denominators: `eps=1e-6` added to every denominator; no inf/NaN.
- Zero-variance channels: `std <= 1e-6` → z-score emitted as 0.0.
- **Z-score skew eliminated**: training calls `fit_zscore_stats(preprocessed_df)` to learn per-channel (mean, std); same dict passed to `engineer_features(..., zscore_stats=...)` and persisted in `PipelineState`. At inference, `PipelineState.zscore_stats` reproduces identical z-scores. When `zscore_stats` is None (legacy), inline batch stats used (single-row → all-zero z-scores).

## 6. Train / Serve Consistency

One fitted `PipelineState` (preprocessor medians + z-score stats) learned on TRAIN only → saved to `models/pipeline_state.pkl` → loaded at serving.

```
TRAIN: records → FittedPreprocessor.fit(train) → transform(train) → fit_zscore_stats → engineer_features(..., zscore_stats) → X_train → model.fit
SERVE: reading → PipelineState.preprocessor.transform_one(reading) → engineer_features(..., zscore_stats=PipelineState.zscore_stats) → X → model.predict_proba
```

`predict_failure` and `detect_anomaly` both resolve `PipelineState` from disk; if absent (old artifact) they fall back to stateless helpers (documented degraded path, z-scores zero).

Invariant verified: MAX_ABS_FEATURE_DIFF batch-vs-single via fitted state = 0.0.

> **NOTE (Phase 4/5 — superseded):** the active serving path no longer uses
> `models/pipeline_state.pkl`, z-scores, or `engineer_features`. Each shipped
> artifact embeds its own `FittedPreprocessor` (train-only medians). Serving runs:
> `reading → app/ml/service.build_pipeline_reading (15 vars) → detect_anomaly +
> predict_failure (artifact-carried preprocessor) → Prediction` (see §3 Phase 4
> contract and `app/ml/contract.py`). `models/pipeline_state.pkl` is orphaned.

## 7. Dataset Provenance

Cited source: UCI Gas Sensor Array Drift Dataset. That dataset is a gas-sensor collection; it does not natively contain the industrial telemetry variables or `machine_failure` above. No transformation lineage is documented in the repository. Provenance therefore **UNKNOWN / UNVERIFIED** — do not claim UCI directly contains this telemetry or these labels.

## 8. Risks & Deferred Decisions (Phase 2)

- `SENSOR_BOUNDS` envelopes generous vs observed ranges; tighten only as Phase 2 validation-policy decision.
- Rule-based thresholds in `prediction.py` / `anomaly.py` (`temperature>150/180`, `vibration>7/50/60`, `pressure>300/400/500`, `power>500`, `rpm<1000/<50k`) unreachable on this dataset scale (e.g. vibration max 0.82). Risk/threshold semantics are Phase 2.
- 10 excluded sensor columns — adding them is a Phase 2 model-selection decision (changes feature vector/model).
- Test harness uses SQLite but models declare `postgresql.UUID`; SQLite cannot bind pg UUIDs (`'str' has no attribute 'hex'`) — pre-existing failures in auth/machines/sensors tests, unrelated to ML.
- `bcrypt 5.0` incompatible with `passlib 1.7.4` (72-byte ValueError); pinned to `bcrypt==4.0.1` in this env for validation. Passlib underneath auth, not ML.
