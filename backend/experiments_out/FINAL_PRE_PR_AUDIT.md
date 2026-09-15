# FINAL PRE-PR ML RELEASE AUDIT

Repository: `karthik32194/-AI-Based-Industrial-Maintenance-and-Process-Optimization-System`
Branch: `main` (clean, no commits made by this audit)
Date: 2026-09-12
Scope: read-only-first release audit of the ML subsystem prior to handoff / Pull Request.

## 1. Release Decision

**GO WITH MINOR CLEANUP**

No ML-correctness, safety, reproducibility, or integration blocker exists. The repository is safe to hand off through a Pull Request. A small number of optional, non-blocking cleanup items remain (dead config, orphaned artifacts); each is documented in §20. Three active-documentation/hygiene defects found during this audit were already corrected (§19).

## 2. Executive Summary

The ML subsystem, already validated through six phases, is internally consistent and release-correct against the locked ML contract:

- Both authoritative artifacts load, match the locked contract (model type, 15 features in pinned order, threshold 0.15 / contamination 0.05, version, dataset hash), and are produced from the correct train-only preprocessing.
- Running the full test suite (81 tests) leaves `models/*.pkl` byte-identical and timestamp-unchanged — the Phase 6 test-isolation guard holds.
- Real-artifact end-to-end flow works on the current repository state: sensor ingest → 15-variable canonical boundary → both models → Prediction/Anomaly persistence → API response `ml_status=VALID`.
- ML-unavailability is represented explicitly as `ML_UNAVAILABLE` (null score/flag, truthy `ml_error`) and is never mapped to a healthy/low-risk result.
- No probability claim exists in live code, schema, API, or the AI prompt; "probability" appears only as a negation.
- Frozen-test metrics (Acc 0.73, P 0.3103, R 0.5625, F1 0.40, AUC 0.7889, PR 0.4139, Conf [[128,40],[14,18]]) remain reproduced exactly and unchanged.
- Three active-documentation/hygiene defects surfaced and were fixed: stale/false ML claims in `backend/README.md`, a Phase-1 `docs/DATA_CONTRACT.md` that described a superseded 5-channel engineered serving path as active, and generated SQLite DB files that would otherwise have entered the PR.

Known limitations are unchanged and documented: `machine_failure` physical meaning unverified; dataset provenance limited; outputs are uncalibrated scores; anomaly `contamination=0.05` is an operating assumption; anomaly ≠ failure; `health_score` is a derived indicator.

## 3. Git / Repository State

Working tree: `main`, no commits made by this audit.

- **Intended changes (modified tracked files):** 18 files — `backend/.gitignore`, `backend/README.md`, and the Phase 5/6 backend integration + validation files (`app/api/deps.py`, `app/ml/*`, `app/models/prediction.py`, `app/models/sensor_reading.py`, `app/schemas/*`, `app/services/*`, `scripts/train_models.py`, `tests/conftest.py`, `tests/test_ml.py`). All are deliberate Phase 5/6 work.
- **Intended additions (untracked new files):** `alembic/versions/0002_phase5_integration.py`, `app/ml/contract.py`, `app/ml/service.py`, `docs/DATA_CONTRACT.md`, `experiments_out/` (phase reports, frozen-test evidence, `phase6_validation.json`), `scripts/experiments/*`, `scripts/phase6_e2e.py`, `scripts/phase6_validate.py`, `tests/test_anomaly.py`, `tests/test_data_contract.py`, `tests/test_failure_risk.py`, `tests/test_ml_integration.py`.
- **Phase 6 validation outputs:** intentionally part of the repository (reports + `phase6_validation.json` + harness scripts). Large binary duplicate `experiments_out/anomaly_final_artifact.pkl` is now gitignored.
- **Accidental files (found, fixed):** `backend/test.db` and `backend/phase6_e2e.db` were untracked + un-ignored and would have entered the PR. `.gitignore` now excludes `*.db` / `*.db-journal`.
- **Secrets/credentials:** none found. No `.env` exists anywhere; only the tracked `.env.example` template (placeholder values only).
- **Generated/temp files:** `__pycache__/`, `.pytest_cache/`, `*.db` — all excluded.
- **Unnecessary datasets / large artifacts:** `models/*.pkl` are gitignored by design (comment: store in object storage). `experiments_out/anomaly_final_artifact.pkl` (3.3 MB duplicate) now ignored.

## 4. Artifact Integrity

All live checks below were run against the actual shipped files in `models/`.

| Artifact | Exists | Loads | Version | Features | Threshold | Dataset Hash | Status |
|---|---|---|---|---|---|---|---|
| failure_risk_artifact.pkl | Yes | Yes | failure_hgb_v1.0 | 15 (order = FAILURE_SENSOR_COLUMNS, verified) | 0.15 | 7796bdba…0207 (set) | ACTIVE |
| anomaly_artifact.pkl | Yes | Yes | anomaly-v1.0 | 15 (order = ANOMALY_SENSOR_COLUMNS, verified) | ≈0.0 (train 0.95-quantile) | 7796bdba…0207 (set) | ACTIVE |
| failure_model.pkl | Yes | — | — | — | — | — | ORPHANED/LEGACY |

Details (loaded via `pickle` + the artifact classes):

- **failure_risk_artifact:** `HistGradientBoostingClassifier`, `class_weight='balanced'`, `max_depth=4`, `max_iter=200`, `random_state=42`; `threshold=0.15`; `feature_names` = the 15 pinned dataset variables; carried `FittedPreprocessor` columns = same 15; train-only medians e.g. `temperature 75.2415`, `vibration 0.50583`. Matches the locked contract exactly. Not a test-generated replacement (see §7 hashes).
- **anomaly_artifact:** `IsolationForest`, `n_estimators=300`, `contamination=0.05`, `random_state=42`; real train threshold ≈ `-4.5e-17` (near-zero-centered IF scores — legitimate, documented since Phase 6, not a toy); carried preprocessor columns = 15. Matches locked contract.
- **failure_model.pkl (2.5 MB, raw `RandomForestClassifier`):** NOT referenced by any loader. `get_failure_model` in `app/ml/prediction.py` is a backward-compatible alias for `get_failure_risk_artifact` and loads `failure_risk_artifact.pkl`, never `failure_model.pkl`. Classification: **ORPHANED / LEGACY**. It is gitignored (never enters the PR). Not deleted per policy (no automatic deletion); recommended for removal in §20.
- `models/pipeline_state.pkl` (272 B): orphan produced by a legacy write in `scripts/train_models.py`; nothing loads it in the final path (both artifacts embed their own preprocessor). Gitignored.

**Note on version control:** `models/*.pkl` are gitignored (object-storage design). The authoritative artifacts therefore are NOT carried by the PR; they are reproducibly regenerated by `python scripts/train_models.py` (dataset SHA-256 `7796bdba…0207` embedded; Phase 6 proved exact frozen-metric reproduction on refit). A fresh clone has no artifacts and the system reports `ML_UNAVAILABLE` until training runs — documented, not a defect.

## 5. Configuration Consistency

- `settings.ml_anomaly_contamination` (`app/core/config.py`, default `0.1`): **DEAD**. Grep across `app/` shows the field is only *defined*, never read. The anomaly path uses the locked operating constant `OPERATING_CONTAMINATION = 0.05` in `app/ml/anomaly.py`. Classification: dead (not a release inconsistency — nothing consumes the differing number). Left unchanged per policy ("do not blindly change configuration merely because the number differs").
- `.env.example` still lists `ML_ANOMALY_CONTAMINATION=0.1`. Cosmetic/stale, low-risk, unchanged (see §20).
- `backend/README.md` previously stated the contamination rate as `0.1` in the env table; corrected to mark the setting as legacy/unused with the fixed constant `0.05` (§19).
- No other stale config found: `ml_model_path`, RAG, LLM, DB all referenced and consistent. Default `secret_key` is a documented placeholder, not a real credential.

## 6. Duplicate / Legacy ML Logic

| Item | Location | Status | Action |
|---|---|---|---|
| `engineer_features`, `get_feature_names`, `fit_zscore_stats` (5-channel ratios/squares/z-scores) | `app/ml/features.py` | LEGACY/DEAD (no app caller; used by `tests/test_ml.py`, `tests/test_data_contract.py`, `scripts/experiments/anomaly_experiment.py`) | None (kept surface) |
| `preprocess_sensor_data`, `preprocess_single`, `validate_reading` (stateless helpers) | `app/ml/preprocessing.py` | LEGACY — `validate_reading` ACTIVE in `sensor_service.py` for ingest bound-check; others TEST/analysis only | None |
| `PipelineState`, `save_pipeline_state`, `zscore_stats` | `app/ml/preprocessing.py` | DEAD for final models (artifacts embed own preprocessor); written only by legacy block in `scripts/train_models.py` | Optional removal (§20) |
| `models/pipeline_state.pkl` | models/ | ORPHANED (gitignored) | Optional removal (§20) |
| `models/failure_model.pkl` (raw RandomForest) | models/ | ORPHANED/LEGACY (gitignored; nothing loads it) | Optional removal (§20) |
| `get_failure_model` alias | `app/ml/prediction.py:134` | DEAD alias for `get_failure_risk_artifact` | None |
| `calculate_machine_health` | `app/ml/prediction.py:250` | DEAD (no caller) | None |
| Fake-healthy fallback in `predict_failure` / `detect_anomaly` (return score 0.0 / flag False when artifact missing) | `app/ml/prediction.py`, `anomaly.py` | DEAD in served path — `app/ml/service.run_inference` checks `available()` first and raises `MLUnavailableError` before these are reached; `prediction_service` maps that to `ML_UNAVAILABLE` | None (guarded; noted in §20 as latent) |
| Heuristic anomaly thresholds / z-score / old 5-feature model paths / probability-based output / risk-category logic | removed in Phase 4; none present in active path | — | — |
| Training-time code at inference | None — inference uses artifact-carried preprocessor and models only, never the CSV | PASS | — |

The active backend path uses the Phase 3/4 artifacts exclusively through the single boundary `app/ml/service.py` (`build_pipeline_reading` → `available()` → `run_inference`).

## 7. Test Artifact Safety

**Hard release gate — PASS.** Running the full test suite cannot overwrite production artifacts.

- `backend/tests/conftest.py` installs a session-scoped autouse fixture `_isolate_ml_artifacts` that redirects the module save/load hooks (`save_failure_risk_artifact`, `save_anomaly_artifact`, `load_failure_risk_artifact`, `load_anomaly_artifact`) to a per-session temp directory for default-path calls. Explicit caller-supplied paths pass through unchanged. Behavior of the training functions themselves is unchanged.
- Before the suite (`SHA-256` / mtime): `failure_risk_artifact.pkl` `d00acc3e9d…` / `2026-09-12 21:19:17.831592800`; `anomaly_artifact.pkl` `bffddc5dbc…` / `2026-09-12 21:19:29.025445100`.
- After the 81-test run: hashes and mtimes **identical**.

## 8. Data Contract Verification

Single canonical source: `app/ml/contract.py`.

- `FAILURE_SENSOR_COLUMNS` = `ANOMALY_SENSOR_COLUMNS` = the same 15 raw variables (pinned order) — the representation both artifacts consume.
- `DATASET_TO_CANONICAL = {rotation_speed → rpm, active_power → power_consumption}` — exactly one mapping source; `map_dataset_to_canonical` is defined in contract.py only.
- Storage (`sensor_readings`) stores all 15 (5 canonical names + 10 raw dataset names); schema `SensorReadingCreate` accepts all 15; service `_reading_from_row` rebuilds the full raw dict; `build_pipeline_reading` maps to the 15 dataset-name keys the artifacts expect.
- `scripts/train_models.py` builds the 15-var training records (`fixed_cols_records`) aligned to the frozen 80/20 split.
- API `PredictRequest` exposes all 15 optional channels.
- Verified end-to-end: the 15 columns that reached the ML boundary in the live run were the exact 15 (`canonical_15_columns`), all present.

## 9. Preprocessing Verification

- `FittedPreprocessor.fit` learns per-column medians on **training data only**.
- Batch `transform` and single-row `transform_one` reuse the fitted medians — no recompute at serving, no re-fit at inference. `train_serve_transform_agree = true` (Phase 6; re-confirmed live for both artifacts).
- The 15-variable path uses `bounds={}` (no range nulling) — medians only; no scaling (IsolationForest is scale-invariant over monotone per-feature transforms; HGB is tree-based); no engineered features enter the final models.
- Medians confirmed present in the artifacts (temperature 75.2415, vibration 0.50583). No duplicate median computation in the active path (legacy stateless helpers are separate, §6).
- `validate_reading` (5-channel bounds) is used only at sensor-ingest for storage validity, not for model input.

## 10. Model Behavior Verification

Live run against the actual shipped artifacts (fixed representative 15-var reading):

- Failure: `failure_risk_score = 0.043665` (finite, in [0,1]), `risk_flag = False`, `health_score = 95.6`, `model_version = "failure_hgb_v1.0"`.
- Anomaly: `is_anomaly = True`, `anomaly_score = 0.076291` (finite), `anomaly_type = "Multivariate state deviates from learned normal distribution"`, `model_version = "anomaly-v1.0"`.
- Determinism: `predict_failure(reading)` and `detect_anomaly(reading)` returned byte-identical results on repeat calls.
- Directional semantics are defined, not assumed: `anomaly_score = -decision_function` (higher = more abnormal). A synthetic extreme reading returned a score of the same order (0.0754 vs 0.0763); this reflects IF score saturation near the operating threshold, not a violation of the `-decision_function` definition — the score remains a deviation score, never a probability.
- Nothing retuned; thresholds/models untouched.

Note: a benign sklearn `UserWarning` ("X does not have valid feature names... IsolationForest") is emitted because `detect_anomaly` passes `df.values`. Cosmetic only (cosmetic finding, §18).

## 11. End-to-End Verification

Current-run `python scripts/phase6_e2e.py` (real artifacts, in-memory SQLite, no production data):

- Real artifacts present: `ml_status=VALID`; `failure_risk_score` finite in [0,1]; `risk_flag` boolean; `model_version="failure_hgb_v1.0"`; anomaly score finite; `anomaly_flag` boolean; all 15 canonical columns reached the boundary.
- Persisted `Prediction`: `ml_status=VALID`, `failure_risk_score` finite, `risk_flag` boolean, `health_score=95.6`, `model_version="failure_hgb_v1.0"`, snapshots `input_rpm=1800.0`, `input_power_consumption=55.0`, `input_humidity=45.0`.
- This is the required flow: `POST /machines/{id}/sensor-readings → validation → persistence → POST /machines/{id}/predict → services → anomaly + failure models → Prediction/Anomaly persistence → API response`. Verified again on the current repository state (not stale Phase 6 evidence).

## 12. ML Failure Safety

**Hard release gate — PASS** (current-run evidence):

- Artifact getters forced unavailable; `run_prediction` persisted: `ml_status="UNAVAILABLE"`, `failure_risk_score=None`, `risk_flag=None`, `ml_error` truthy.
- `ml_unavailable_never_fake_healthy = true` — unavailable is never represented as `score=0` / `flag=False`.
- Mechanism: `app/ml/service.run_inference` calls `available()` first; on any missing artifact it raises `MLUnavailableError`; `prediction_service.run_prediction` catches it and persists an explicit UNAVAILABLE record. `ai_service` reads UNAVAILABLE conservatively (MEDIUM priority, never downgraded to low/healthy).
- The module-level fallbacks in `predict_failure`/`detect_anomaly` are unreachable in the served path because the boundary guards first.

## 13. Database / Migration Verification

- `alembic/versions/0001_initial_schema.py` (baseline) and `0002_phase5_integration.py` verified.
- `0002` upgrade: adds 10 raw sensor columns, adds `failure_risk_score`, `risk_flag`, `ml_status` (server_default `VALID`), `ml_error`, 10 additional `input_*` snapshot columns, makes `model_version` nullable, and drops the old `failure_probability`, `predicted_failure`, `risk_level`, `health_status`.
- `0002` downgrade: re-adds the old columns + enums, restores `model_version` NOT NULL, and drops the Phase-5 additions symmetrically. Coherent.
- `Prediction` ORM matches the final schema exactly (`failure_risk_score`, `risk_flag`, `health_score`, `anomaly_detected`, `ml_status`, `ml_error`, `model_version` nullable, 15 `input_*`).
- `Anomaly` schema unchanged/disposed correctly; `ml_error` can represent the unavailable state; `model_version` is persisted on VALID records and null on UNAVAILABLE, as intended.
- No stale probability/category field is expected by active code (verified: no reads of `failure_probability`/`risk_level`/`health_status` in `app/`).
- Migrations are PostgreSQL-only (enums, pgvector); tests use SQLite via `Base.metadata.create_all` and do not run Alembic. No destructive operation against any external production database was performed.

## 14. API Contract Verification

Response schema (`PredictionResponse`) exposes exactly the honest, active contract:

- `failure_risk_score` (Optional float, ge 0 le 1) — risk score, NOT probability
- `risk_flag` (Optional bool)
- `health_score` (Optional, 0–100) — derived indicator
- `anomaly_detected` (bool)
- `ml_status` ("VALID" / "UNAVAILABLE")
- `ml_error` (Optional)
- `model_version` (Optional)
- 15 `input_*` snapshot fields
- `created_at`

No field describes the score as a probability. `POST /api/machines/{id}/predict` returns `201` with this schema (auth: maintenance-engineer or admin). No `failure_probability`/`risk_level` keys remain (asserted in tests).

## 15. Full Test Suite

Complete run of `backend/tests` on the current repository state:

- **total:** 81
- **passed:** 81
- **failed:** 0
- **skipped:** 0
- Warnings: 31 (deprecation/benign — e.g. `HTTP_422_UNPROCESSABLE_ENTITY`, `datetime.utcnow`, IF feature-name, `Mean of empty slice`). None are ML-correctness or release-blocking.

Matches the Phase 6 baseline (81 passed). No new/preexisting/environmental failures.

## 16. Documentation / Claims Audit

- All phase reports (`PHASE2–PHASE6`) treat "probability" only as a negation and correctly state the score/indicator semantics; these are historical and were not rewritten.
- **Fixed — active doc, false claim:** `backend/README.md:202` ("Health score — derived from failure probability (0–100)"). Health score is derived from `failure_risk_score`, not a probability. Corrected.
- **Fixed — active doc, stale pipeline:** `backend/README.md` ML-pipeline step list described ratios/z-scores/polynomial feature engineering, a RandomForest, and a rule-based fallback — all removed in Phase 4. Replaced with the final 15-var / HGB / IsolationForest / honest-health description.
- **Fixed — active doc, stale stack/table:** `backend/README.md` tech-stack row (RandomForest → HistGradientBoostingClassifier) and the ml file-tree block (added `contract.py`, `service.py`, corrected `prediction.py`, marked `features.py` legacy). Env-table contamination row corrected.
- **Fixed — active doc, superseded contract:** `docs/DATA_CONTRACT.md` described the Phase-1 5-channel engineered serving path (z-scores, `PipelineState`) as active and listed 10 columns as "excluded from ML." It is materially wrong against the final 15-var artifact contract; added a prominent STATUS banner and corrected the serving-path note (§6). Historical body retained.
- No "guarantee", "production-ready validated", "real-world validated", "RUL", or "independent variables" claim appears in active code/docs README-facing material (the phrase "independent variables" appears only in the historical Phase 2 report).

## 17. PR Hygiene

- **Secrets:** none. No `.env` file exists anywhere; `.env.example` contains placeholders only; config default `secret_key` is a documented placeholder.
- **Ignored (post-fix):** `__pycache__`, `.pytest_cache`, `*.py[cod]`, `*.db`, `*.db-journal`, `experiments_out/*.pkl`, `models/*.pkl` (object-storage design), logs.
- **Generated test DBs** (`backend/test.db`, `backend/phase6_e2e.db`) and the **3.3 MB duplicate** `experiments_out/anomaly_final_artifact.pkl` — now excluded via `.gitignore` (would otherwise have entered the PR).
- No editor files, no caches, no logs, no large unwanted binaries in the PR set.
- Untracked content entering the PR is intentional: migration, `contract.py`, `service.py`, docs, experiment reports/evidence CSV/JSON, harness scripts, and the new test files.
- `tests/status` is a pre-existing tracked text file from the original author (an ML status tracker describing now-removed behavior). Pre-existing, not introduced by this work; left untouched (flagged cosmetic).
- `.gitignore` adequacy: ✅ after this audit's additions.

## 18. Issues Found

**BLOCKING** — none.

**NON-BLOCKING** (no correctness/safety impact; fixed in this audit as required):
- `backend/README.md` stale/false ML claims (RandomForest, engineered features, rule-based fallback, "failure probability"). → Fixed.
- `docs/DATA_CONTRACT.md` described the superseded 5-channel engineered path as active. → Fixed.
- Generated DB files + duplicate experiment pkl would enter the PR. → Fixed via `.gitignore`.

**COSMETIC** (documented or left per policy; none requires change for release):
- `settings.ml_anomaly_contamination` (0.1) is dead config; anomaly uses fixed 0.05. (Not a cross-inconsistency; config.py, `.env.example`, and the README previously all said 0.1. README corrected to label it legacy.)
- `models/failure_model.pkl` (raw RandomForest) and `models/pipeline_state.pkl` orphaned; gitignored. Left in place per policy (no auto-delete).
- Latent fake-healthy fallbacks in `predict_failure`/`detect_anomaly` (guarded, unreachable in served path; module-level surface only). Optional hardening.
- `calculate_machine_health` and `get_failure_model` are dead symbols (no callers).
- sklearn feature-name `UserWarning` from `detect_anomaly` passing `df.values`.
- `tests/status` pre-existing loose tracker file (from original author).
- `scikit-*` deprecation/`utcnow` warnings in suite (31 total, non-fatal).

## 19. Fixes Made

Exact changes in the working tree (all within audit policy scope: active-doc false statements + repository hygiene; no ML algorithm/threshold/feature/behavior change):

1. `backend/.gitignore` — added `*.db`, `*.db-journal` (exclude generated test/scratch DBs) and `experiments_out/*.pkl` (exclude large duplicate experiment binary).
2. `backend/README.md`
   - Tech-stack row: `RandomForest` → `HistGradientBoostingClassifier`.
   - ML file-tree block: added `contract.py` + `service.py`, corrected `prediction.py` label, marked `features.py` legacy.
   - ML-pipeline step list (5-step inventory): replaced with the final 15-var / IsolationForest / HGB / honest-health / UNAVAILABLE description.
   - Env table: `ML_ANOMALY_CONTAMINATION` row marked legacy/unused (fixed constant `0.05`).
3. `backend/docs/DATA_CONTRACT.md` — added a STATUS banner documenting the final 15-var artifact contract and superseding the 5-channel engineered/z-score/`PipelineState` path; added a note clarifying the active serving path.

No models, thresholds, algorithms, features, or training behavior were changed. No code logic was modified.

## 20. Remaining Cleanup

Optional, non-blocking; safe to defer or do before merge — no item affects correctness, safety, or reproducibility:

- Remove dead config `ml_anomaly_contamination` (and its `.env.example` line) — the anomaly path uses the locked constant `0.05`. (Safe only because the field is unused; doing so removes reviewer confusion.)
- Remove orphaned `models/failure_model.pkl` (legacy raw RandomForest) and `models/pipeline_state.pkl`, plus the legacy `PipelineState`/z-score write block in `scripts/train_models.py`.
- Consider removing the latent module-level fake-healthy fallback in `predict_failure`/`detect_anomaly` (or making it raise) — currently unreachable in the served path because `ml.service.run_inference` guards first.
- Remove dead `calculate_machine_health` / `get_failure_model` symbols.
- Pass `df` (not `df.values`) in `detect_anomaly` to silence the IF feature-name warning.
- Delete or refile `tests/status` (loose pre-existing tracker).

## 21. Final Recommendation

**GO WITH MINOR CLEANUP**

- Code, artifacts, config, tests, API, database, and documentation are internally consistent and match the locked ML contract.
- Both hard release gates (test artifacts cannot overwrite production models; ML failure is explicit `ML_UNAVAILABLE`, never fake-healthy) pass with current-run evidence.
- The only items remaining are the optional cleanups in §20. No release-blocking defect exists. The repository is ready for the Pull Request as-is; the §20 items are recommended but not required.

## 22. Handoff Confirmation

- **Authoritative artifacts:** `models/failure_risk_artifact.pkl` (failure_hgb_v1.0) and `models/anomaly_artifact.pkl` (anomaly-v1.0). Note: both are gitignored (object-storage design) and reproducibly regenerated via `python scripts/train_models.py` (dataset SHA-256 `7796bdba…0207`).
- **Authoritative ML service:** `app/ml/service.py` — `build_pipeline_reading`, `available()`, `run_inference`; `app/services/prediction_service.run_prediction` is the only orchestration entry.
- **Authoritative feature contract:** `app/ml/contract.py` — 15 raw variables; `FAILURE_SENSOR_COLUMNS` = `ANOMALY_SENSOR_COLUMNS`; mapping `rotation_speed → rpm`, `active_power → power_consumption`.
- **Model versions:** `failure_hgb_v1.0`; `anomaly-v1.0`.
- **Thresholds:** failure-risk operating threshold `0.15`; anomaly contamination `0.05` (train 0.95-quantile threshold, ≈0.0).
- **Output semantics:** `failure_risk_score` = uncalibrated risk score (not a probability); `anomaly_score` = deviation score, higher = more abnormal; `health_score` = derived indicator. No probability/category/RUL/physical-health claims.
- **ML_UNAVAILABLE behavior:** explicit `ml_status="UNAVAILABLE"` with null score/flag and truthy `ml_error`; never silently healthy.
- **Known limitations (unchanged):** `machine_failure` physical meaning unverified; dataset provenance/commercial representativeness limited; outputs uncalibrated; anomaly contamination an operating assumption; anomaly ≠ failure; real-world generalization unproven; anomaly ground truth unavailable.