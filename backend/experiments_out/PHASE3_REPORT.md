# PHASE 3 — ANOMALY DETECTION IMPLEMENTATION AND VALIDATION
## FINAL REPORT

**Date:** 2026-09-12
**Phase status prerequisite:** Phase 1 PASS; Phase 2 PASS WITH NON-CRITICAL LIMITATIONS
**Design language:** Unsupervised anomaly detection ≠ failure classification. Failure-label overlap = secondary sanity check, NOT anomaly ground truth.

---

### 1. Objective
Deliver a defensible, production-ready **unsupervised** anomaly detection subsystem answering: *"Is the current multivariate machine operating state unusual relative to the learned normal operating distribution?"* This is distinct from failure prediction (Phase 4) and does not require or fabricate ground-truth anomaly labels.

### 2. Scope of work
Modified:
- `backend/app/ml/contract.py` — added `ANOMALY_SENSOR_COLUMNS` (15 raw dataset variables, pinned order).
- `backend/app/ml/preprocessing.py` — generalized `FittedPreprocessor` to arbitrary columns + optional bounds; backward-compatible with Phase 1/2 5-variable state.
- `backend/app/ml/anomaly.py` — rewrote anomaly subsystem (artifact, training, inference). Removed heuristic physical thresholds.
- `backend/scripts/train_models.py` — added `build_anomaly_records`, index-based split, `dataset_hash`, anomaly training step.
- `backend/tests/test_anomaly.py` — new (11 tests).
- `backend/scripts/experiments/anomaly_experiment.py` — experiment harness.
- `backend/scripts/experiments/anomaly_final_reproduction.py` — final independent reproduction.

NOT modified (explicitly out of scope): RAG, LLM, frontend, unrelated backend, Phase 4 failure model logic, Phase 5 API integration.

### 3. Data limitations (declared)
Only `machine_failure` label exists. Its meaning is **unverified**. No ground-truth anomaly label exists. `machine_failure` is **not** treated as anomaly ground truth. No anomaly labels are fabricated.

### 4. Audit-first result
Read-only audit confirmed: no functional anomaly model existed; only a heuristic `_classify_anomaly_type` with unrealistic physical thresholds (temp>200, vibration>50, pressure>500, rpm>50k). No active anomaly serving path was wired. Audit completeness: high.

### 5. Anomaly representation selection
Chosen: **all 15 raw industrial variables** (`ANOMALY_SENSOR_COLUMNS`).
Evidence (experiments, `anomaly_experiment.json`):
| representation | AUROC (secondary overlap) |
|---|---|
| raw5 | 0.620 |
| **raw15 (chosen)** | **0.602** |
| scaled15 | 0.602 (== raw15) |
| eng15 | 0.643 |

raw15 chosen for completeness and alignment with Phase 2 final representation. Scale-invariance proven (scaled15 ≡ raw15) → no scaling added, keeping representation simple and monotone-transform-stable.

### 6. Normal operating distribution
Learned from **all observations** (train split). Contamination parameter accounts for outliers during fitting. Failure labels not used (avoids encoding failure-as-anomaly assumption). Evidence: all-pop AUROC 0.602 ≈ normal_only 0.585 → no meaningful loss, and ALL avoids circularity.

### 7. Isolation Forest configuration
`n_estimators=300`, `random_state=42`, `n_jobs=-1`, contamination operating assumption. Experimentation was controlled and small (contamination sweep: 0.02–0.20; seed stability: 3 seeds, stable scores). Interpretable: default sklearn IF, documented hyperparameters, no search-driven overfitting.

### 8. Contamination investigation
**Failure prevalence ≠ anomaly prevalence.** Dataset failure rate differs from any defensible anomaly rate; anomaly prevalence is not knowable from the data. Therefore contamination is an **operating assumption**, documented, not a fitted truth. Chosen `OPERATING_CONTAMINATION = 0.05` — flags the rarest states. Documented in code + report.

### 9. Anomaly score definition
`anomaly_score = -decision_function(X)`. **Higher = more abnormal.** This is a deviation score, **NOT a probability**. Direction verified (synthetic outlier scores above normal; test `test_score_direction_higher_more_abnormal`).

### 10. Threshold selection (no test contamination)
`threshold = train-side (1 - contamination) quantile`, computed at fit time **on training data only**, persisted in the artifact. Test set never touched during threshold selection. Reproduced: train contam 0.05 → test flagged rate **0.045** (≈5%, matching assumption).

### 11. Evaluation WITHOUT ground truth (declared)
No scientific accuracy claim is made. Reported: flagged rate on test (0.045), score distribution (min -0.109, max 0.072, sd 0.029), threshold value (≈0). These are operating characteristics, not correctness metrics.

### 12. Temporal sanity
Pass. Chronological halves flagged rates 0.050 vs 0.048; score means -0.0498 vs -0.0477. Score autocorr lag 1–3: r ≈ -0.05, -0.01, +0.05 (no time clustering / drift). No future data used (detector uses row-local features only).

### 13. Feature contribution
Multi-variable, not single-sensor collapse (per-variable deviation analysis): rotation_speed, pressure, current, vibration contribute. No one implementation detail dominates anomaly scores (across-variable spread verified).

### 14. Failure-label overlap — secondary sanity check
Test overlap: 3/32 failures also flagged by anomaly detector. Reported **as a sanity check only**. It does NOT validate the anomaly detector, does NOT establish anomaly→failure causality, and must not be read as precision. Anomalies flag unusual *states*; failures are a separate label with unverified meaning.

### 15. Anomaly types
Deferred (not implemented). The heuristic physical thresholds were removed as unrealistic at this dataset's scale. A specific type is returned only when statistically evidenced; for now the detector returns a single generic explanation: `"Multivariate state deviates from learned normal distribution"`. This is honest given unknown failure mechanism.

### 16. Train/serve consistency
`FittedPreprocessor` (median imputation, pinned column order) learned on train is bundled in the persisted artifact and reused verbatim for single-row inference → no train/serve skew. Proven by `test_preprocessing_train_serve_consistent` and `test_missing_follows_fitted_median`.

### 17. Model persistence & reproducibility
`AnomalyArtifact` is self-describing: model + fitted preprocessor + threshold + contamination + feature_names + random_state + dataset_hash + version. Persisted to `models/anomaly_artifact.pkl` (version `anomaly-v1.0`). `dataset_hash` (sha256 of raw CSV) enables reproducibility. Reload equivalence proven (identical inputs → identical scores, <1e-6).

### 18. Backend boundary
Clean callable interface only: `train_anomaly_model(records, ...) -> AnomalyArtifact` and `detect_anomaly(reading) -> dict`. No Phase 5 API redesign. Serving path (via `get_anomaly_artifact` cache) reads persisted artifact. Safe fallback when artifact absent (returns not-anomaly, logs warning).

### 19. Testing
11 anomaly tests pass; full suite `test_anomaly.py` + `test_data_contract.py` + `test_ml.py` → **40 passed**. Coverage: feature order, train/serve preprocessing consistency, median imputation, valid/invalid input, no NaN/inf features, extreme-but-valid no-crash, deterministic inference, score direction, boolean threshold determinism, artifact reload equivalence, artifact roundtrip serialization.

### 20. Self-validation checklist
| item | status |
|---|---|
| Re-read all modified files | PASS |
| Trace anomaly path train→inference | PASS |
| Verify train & inference both run | PASS |
| Search old heuristic thresholds | PASS (removed; docstring-only mention) |
| No unrealistic hardcoded anomaly thresholds active | PASS |
| Contamination documented as assumption | PASS |
| Threshold documented | PASS |
| Score direction verified | PASS |
| No future data | PASS |
| No accidental target leakage | PASS (anomaly path uses 15 raw vars only) |
| machine_failure NOT direct anomaly ground truth | PASS |
| Label sanity check clearly secondary | PASS |
| Run all anomaly tests | PASS (40 passed) |
| Reload persisted artifact | PASS |
| Identical inputs through original+reloaded, tolerance | PASS (<1e-6) |
| Independently reproduce final experiment | PASS (0.045 flagged, contam 0.05) |
| Anomaly-rate stability | PASS (early 0.050 / late 0.048) |
| No single implementation detail dominates | PASS (multi-variable contribution) |
| Diagnose/rectify/rerun on defect | PASS (no defect found) |

### 21. Known non-critical limitations
- **Contamination 0.05 is an operating assumption**, not ground truth → flagged rate ≈5% is a chosen operator, not evidence of correctness.
- Anomaly detection has **no ground truth to score against** → correctness cannot be scientifically established; operating characteristics only.
- No specific anomaly **type** labels (deferred).
- sklearn emits a cosmetic "feature names" UserWarning on infernece (fitted w/ names, predicted w/ ndarray); outputs identical — non-functional.

### 22. Final Verdict
**PASS.** The unsupervised anomaly detection subsystem is defensible: correct score semantics, evidence-based threshold (no test contamination), train/serve consistency via persisted artifact, reproducible persistence, clean callable boundary, heuristic thresholds removed, 40 tests pass, all 20 self-validation items PASS, and conflation with failure classification is explicitly and structurally avoided. Limitations are documented and non-critical.

**Phase 4 (failure prediction) may begin.** Anomaly detection stands as an independent, complementary capability. Phase 4 supervised failure modeling is unaffected by — and must remain distinct from — this unsupervised subsystem.