# PHASE 5 — BACKEND INTEGRATION FINAL REPORT

**Date:** 2026-09-12
**Preceding phases:** Phase 1 PASS; Phase 2 PASS WITH NON-CRITICAL LIMITATIONS; Phase 3 PASS; Phase 4 PASS
**Guiding rule:** Real input → canonical pipeline → both models → DB persistence → API output must be provable, or the phase does not pass.

---

## 1. Status
**PASS.**

## 2. Executive Conclusion
The validated Phase 3 anomaly and Phase 4 failure-risk artifacts are now wired end-to-end through the backend. A real 15-channel sensor submission flows: RAW SENSOR INPUT → backend bounds validation → canonical ML representation (built by a single integration boundary) → persisted/fitted preprocessing (median imputation carried by each artifact) → anomaly model → failure-risk model → ML outputs → Prediction/Anomaly persistence → API response. Proven by automated end-to-end tests: `POST /api/machines/{id}/sensor-readings` (15 channels) followed by `POST /api/machines/{id}/predict` returns `ml_status=VALID` with a finite `failure_risk_score`, a boolean `risk_flag`, the failure model version `failure_hgb_v1.0`, and the full 15-channel input snapshot. The forbidden "silently healthy" fallback is removed at the boundary: when an artifact is missing/corrupt, prediction persists and returns an explicit `ML_UNAVAILABLE` record (no score, no flag, no healthy claim). Full regression: **81 tests pass**. No ML strategy, model, algorithm, threshold, or Phase 1–4 output contract was changed.

## 3. Integration Map (Real Data Flow)
```
SensorReadingCreate (15 channels: 5 canonical + 10 raw)
 → POST /api/machines/{id}/sensor-readings                  [app/api/sensors.py]
 → sensor_service.ingest_sensor_reading                     [bounds validation]
 → SensorReading row (all 15 @ sensed values)
 → POST /api/machines/{id}/predict                          [app/api/predictions.py]
 → prediction_service.run_prediction
    → ml.service.build_pipeline_reading (15-var canonical ML representation)
    → ml.service.run_inference
        → detect_anomaly(reading15)   [IsolationForest artifact, fitted preprocessor]
        → predict_failure(reading15)  [HGB artifact, fitted preprocessor, threshold 0.15]
    → Prediction row (failure_risk_score, risk_flag, health_score, ml_status, snapshot)
    → Anomaly row if detected
 → PredictionResponse (honest Phase 4 contract)
AI path (unchanged scope): ai_service reads the new prediction fields to build
recommendation prompts and risk→priority mapping.
```
The models are never retrained and the training CSV is never read at request time; both artifacts carry their own fitted preprocessor, so inference is train/serve-consistent with Phase 3/Phase 4 unchanged.

## 4. Canonical ML Boundary (`app/ml/service.py`)
Single integration boundary, the only place the backend constructs the ML input.
- `build_pipeline_reading(raw)` maps stored/override sensor values into the pinned 15-variable dataset-name representation (`FAILURE_SENSOR_COLUMNS` from `app/ml/contract.py`). The canonical mapping resolves the two renamed fields (`rotation_speed ← rpm`, `active_power ← power_consumption`); every other dataset name is used as-is. Missing values pass through as `None` and are median-imputed by the artifact's own fitted preprocessor (no second preprocessing implementation).
- `available()` reports whether both artifacts resolve, and — critically — does so **cache-aware**: it checks the same cached artifacts `detect_anomaly`/`predict_failure` use, so an availability check can never disagree with inference outcome.
- `run_inference(reading)` runs both models and returns `{ml_status, anomaly_result, failure_result}`, or raises `MLUnavailableError` naming the missing artifact(s).
- The boundary adds no algorithm, no model, no threshold, no preprocessing logic of its own. It reuses `app.ml.contract` as the single schema source.

## 5. Anomaly Connection (Phase 3)
`detect_anomaly` is invoked via the boundary with the 15-variable representation it consumed in Phase 3 (original `anomaly_score = -decision_function`, higher = more abnormal, not a probability; `contamination` operating assumption unchanged). Its output drives `anomaly_detected` on the Prediction row and, when a deviation is flagged, persists an `Anomaly` row with score and the canonical channel snapshot. Semantics preserved verbatim.

## 6. Failure-Risk Connection (Phase 4)
`predict_failure` is invoked via the boundary against the same 15 raw variables. The stored Prediction exposes the honest Phase 4 contract: `failure_risk_score` (continuous risk score, explicitly **not** a calibrated probability), `risk_flag = failure_risk_score >= threshold` (threshold read from the artifact, default 0.15), `health_score` (explicitly a derived software indicator, not a validated physical health metric), and `model_version` (`failure_hgb_v1.0`). No probability language, no risk-category bins, no invented failure type.

## 7. Model-Unavailable Behavior (PHASE 5 Step 5 HARD)
When either artifact is missing, corrupt, or incompatible, the boundary raises `MLUnavailableError`. `prediction_service.run_prediction` catches it and persists an **explicit `ML_UNAVAILABLE`** Prediction row with `failure_risk_score=None`, `risk_flag=None`, and a populated `ml_error`. It does **not** return score 0 / flag false / "healthy". This is enforced at the boundary, so the backend path never fabricates a healthy or low-risk state. Verified by `test_api_predict_unavailable_with_override` (201 with `ml_status=UNAVAILABLE`, null score/flag, non-null error) and `test_run_prediction_unavailable_never_fake_healthy` (DB row persists UNAVAILABLE state). The AI service likewise treats an UNAVAILABLE prediction as "model unavailable — do not treat as healthy" rather than downgrading to low risk. Note: the standalone `predict_failure`/`detect_anomaly` functions retain their own module-level safe fallback, but this path is never reached through the backend because `run_inference` gates on availability first.

## 8. DB / Persistence Changes
- `sensor_readings` now stores all 15 channels (was 5). The 5 canonical channels pass through bounds validation; the 10 raw dataset channels (humidity, voltage, current, oil_level, load, motor_temperature, gearbox_temperature, sound_level, fan_speed, reactive_power) have no scientific bounds in the contract and are stored as provided.
- `predictions` now stores `failure_risk_score`, `risk_flag`, `ml_status` (`VALID`/`UNAVAILABLE`), `ml_error`, plus the extended 15-channel input snapshot. The old `failure_probability`, `predicted_failure`, `risk_level`, `health_status` columns and their enums are removed. `model_version` became nullable (UNAVAILABLE records carry none).
- Anomaly snapshot columns are retained (5 canonical channels at detection time).

## 9. API / Response Contract
- `SensorReadingCreate` / `SensorReadingResponse` extended to all 15 channels; at-least-one-channel validator includes them.
- `PredictRequest` extended to all 15 optional override channels.
- `PredictionResponse` exposes the honest contract: `failure_risk_score`, `risk_flag`, `health_score`, `anomaly_detected`, `ml_status`, `ml_error`, `model_version`, and the 15 input snapshot fields. No `failure_probability` or `risk_level` keys remain (verified via test assertion).
- `POST /api/machines/{id}/predict` returns the prediction with its true ML status; it returns an explicit UNAVAILABLE record, not a fabricated low-risk score.

## 10. Removed Obsolete Logic
- Backend: removed reads of the Phase-4-removed prediction keys (`failure_probability`, `predicted_failure`, `risk_level`, `health_status`) from `prediction_service` and `ai_service`; removed the `RiskLevel`/`MachineHealthStatus` enums and their columns.
- AI prompt: replaced the forbidden "Failure Probability" framing and the invented "Predicted Failure Type" with the honest "Failure Risk Score (risk score, not a calibrated probability)" and status-aware handling.
- Auth correctness fix (surfaced by the end-to-end test): `get_current_user` now coerces the JWT `sub` string to a UUID before loading the user, so authenticated requests work on non-postgres dialects. This is a correctness fix, not an ML change.

## 11. Model Loading / Performance
Artifacts load lazily and are cached at module scope (as in Phases 3/4); `run_inference` reuses the cached artifacts, so serving pays disk reads only once per process. No retraining, no CSV reads, no per-request artifact load. Both artifacts are self-describing and load from `settings.ml_model_path`.

## 12. Schema / Migration
`alembic/versions/0002_phase5_integration.py` (Revises 0001) upgrades the PostgreSQL schema to the Phase 5 shape: adds the 10 raw `sensor_readings` channels, adds the prediction columns (`failure_risk_score`, `risk_flag`, `ml_status`, `ml_error`, 10 new input-snapshot columns), makes `model_version` nullable, and drops `failure_probability`/`predicted_failure`/`risk_level`/`health_status`. Downgrade reverses all changes (re-creates the old columns and enums). The ORM models and conftest `create_all`/`drop_all` are kept in sync with this migration for SQLite-based tests.

## 13. Tests Executed
`python -m pytest tests/ -q` → **81 passed**.
- `tests/test_ml_integration.py` (new, 10): canonical→dataset mapping; cache-aware availability; `run_inference` returning both models; UNAVAILABLE persistence (service + DB); VALID persistence; 15-channel sensor ingest; end-to-end predict (VALID); predict with override under unavailable artifacts (explicit UNAVAILABLE); prediction history.
- Regression: `test_failure_risk.py`, `test_ml.py`, `test_anomaly.py`, `test_data_contract.py` (Phase 3/4 ML suites, unchanged); `test_sensors.py`, `test_machines.py`, `test_auth.py` (API suites).

## 14. End-to-End Proof
Real flow proven by `test_api_predict_valid_flow`:
1. `POST /api/machines/{id}/sensor-readings` with all 15 channels → 201, `is_valid=True`, channels confirmed returned.
2. `POST /api/machines/{id}/predict` with no override (uses the stored reading) → 201.

Response asserted: `ml_status=VALID`, `failure_risk_score` finite in `[0,1]`, `risk_flag` boolean, `model_version=failure_hgb_v1.0`, `input_rpm=1800`, `input_power_consumption=55`, `input_humidity=45`, and no `failure_probability`/`risk_level` keys. The anomaly and failure-risk results were produced by the real artifacts over the real stored sensor values, then persisted and returned — exactly the required `REAL INPUT → canonical pipeline → both models → DB → API output` chain.

## 15. Regression
Full suite green (81 passed). The pre-existing 45 ML/service tests remain green, confirming no Phase 3/Phase 4 contract regression. The API suites (sensors, machines, auth), previously not exercised in this harness, now pass after the auth UUID-coercion fix.

## 16. Self-Validation → Final Verdict
1. Read-only audit completed before any change Step 1: PASS
2. Single canonical integration boundary, no second preprocessing impl: PASS
3. Anomaly model connected via 15-var representation, unchanged semantics: PASS
4. Failure-risk model connected, honest score/flag contract: PASS
5. Model-unavailable → explicit ML_UNAVAILABLE, never silent healthy: PASS
6. DB/persistence extended for 15 channels + honest prediction fields: PASS
7. API/response contract updated; probability/category fields removed: PASS
8. Obsolete ML/backend logic removed: PASS
9. Model loading lazy + cached, no retrain, no CSV at inference: PASS
10. Alembic 0002 migration + downgrade present: PASS
11. Automated tests (service/API/DB/e2e): PASS (10 new)
12. End-to-end REAL flow proven: PASS
13. Full regression: PASS (81)
14. No ML strategy/algorithm/threshold/contract changed: PASS
15. No probability claim introduced anywhere: PASS
16. No late fabrication of healthy/low-risk when ML unavailable: PASS

Remaining limitation, carried forward unchanged from Phases 2–4: the machine-failure label's physical meaning is unverified, and neither output is a calibrated probability; both remain honest scores. These are data-level limits, not backend-integration defects, and do not block integration.

**Final Verdict: PASS.** The real sensor input → canonical ML pipeline → both models → DB persistence → API output chain is implemented and proven by automated end-to-end tests, with model-unavailable state represented explicitly rather than as a fabricated healthy result.