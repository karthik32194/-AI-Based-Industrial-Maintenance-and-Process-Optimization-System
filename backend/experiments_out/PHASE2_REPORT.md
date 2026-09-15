# PHASE 2 — ML EXPERIMENTATION FINAL REPORT

Artifact record of Phase 2 experiments. Numerical source: `experiment_results.json`,
`stage2_results.json`, `final_strategy_result.json`. Dataset SHA256:
`7796bdba32a09391cd76b09a04f0e72cdfa5545037d01b2064b2948ff3510207`.

## 1. Status
PASS WITH NON-CRITICAL LIMITATIONS

## 2. Executive Conclusion
1000-row, 16.2% positive, 15 weakly-informative independent variables. Every
feature carries weak signal (max |corr| with target 0.18); all models beat dummy
(roc 0.507) but no model reaches strong discrimination. Adding the 10 excluded
variables genuinely improved ranking (feature set A→B). Engineered features gave
no gain. HistGradientBoosting (balanced) over all 15 raw variables, threshold
0.15, is the most defensible strategy: highest F1, smooth continuous risk score,
usable operating-point flexibility, no external dependency. Output must be called
FAILURE RISK SCORE, not calibrated probability. Current-state classification is
the only defensible formulation; future prediction and RUL are not supported by
the data.

## 3. Dataset Findings
- 1000 rows, 17 cols, 0 nulls, 0 duplicate rows, 0 duplicate timestamps.
- timestamp 2024-01-01→2024-02-11, fixed hourly grid, monotonic. ~42 days.
- Target 838/162 (16.2%). All 15 variables continuous, independent (max pairwise
  |corr| 0.073), no constants.
- Target autocorrelation ≈0 at all lags; failure runs singleton (140 runs,
  mean len 1.16, max 3). Failures are isolated, non-persistent events.
- Weak class separation: temperature cohen-d +0.49, vibration +0.46; strongest
  correlations with target: temperature +0.18, vibration +0.17.

## 4. Feature-Set Comparison
5×3 repeated stratified CV, balanced weights, mean metrics:

| Feature Set | Features | Model | Split | Precision | Recall | F1 | ROC-AUC | PR-AUC | Key Finding |
|---|---|---|---|---|---|---|---|---|---|
| A (current 5) | 5 raw | HGB | 5×3 CV | 0.292 | 0.328 | 0.305 | 0.662 | 0.326 | weakest ranking |
| A | 5 raw | LogisticRegression | 5×3 CV | 0.276 | 0.656 | 0.388 | 0.696 | 0.323 | high recall, low prec |
| A | 5 raw | RandomForest | 5×3 CV | 0.379 | 0.231 | 0.281 | 0.712 | 0.370 | solid rank but low recall |
| B (all 15) | 15 raw | HGB | 5×3 CV | 0.454 | 0.338 | 0.386 | 0.767 | 0.420 | **best F1 + smooth score** |
| B | 15 raw | LogisticRegression | 5×3 CV | 0.271 | 0.615 | 0.375 | 0.709 | 0.358 | recall strong, prec poor |
| B | 15 raw | RandomForest | 5×3 CV | 0.651 | 0.123 | 0.203 | 0.789 | 0.431 | **best ranking**, recall collapses at 0.5 |
| C (B+engineered) | 23 | HGB | 5×3 CV | 0.392 | 0.303 | 0.339 | 0.745 | 0.400 | no gain over B |
| C | 23 | RandomForest | 5×3 CV | 0.570 | 0.146 | 0.229 | 0.780 | 0.426 | no gain over B |
| C | 23 | LogisticRegression | 5×3 CV | 0.277 | 0.621 | 0.383 | 0.710 | 0.356 | no gain |
| Dummy (stratified) | 15 | Dummy | 5×3 CV | 0.175 | 0.162 | 0.168 | 0.507 | 0.171 | noise floor |

Final selected feature representation: **B (all 15 raw industrial variables)**.
A→B ranking gain (HGB roc 0.662→0.767) is meaningful. C→B no gain, rejected.

## 5. Leakage Investigation
- Checked correlations: no feature derived from target (max |corr| 0.18, temp/vib);
  no deterministic relationship. No feature near leaks label.
- Collinearity: max pairwise |corr| = 0.073 (current~sound_level −0.073) — features
  statistically independent. No quasi-duplicate feature to leak.
- Temporal: hourly, monotonic, feature value at time t known at t; no row depends
  on a future timestamp. No post-failure measurement variable exists.
- Autocorrelation ≈0 ⇒ no hidden run-structure leakage.
Result: no leakage found. No feature excluded for leakage. Weak signal is real,
not artifact.

## 6. Temporal Analysis
- No failure persistence: target autocorrelation ≈0, failure runs mean length
  1.16 (max 3). Class does not cluster in time.
- Chronological holdout (first 800/ last 200) HGB: roc 0.831, pr 0.519 — NOT worse
  than random CV (roc 0.767/pr 0.420). Random stratified splitting is NOT
  optimistic here.
- Conclusion: random stratified repeated-CV is the primary validation method;
  chronological holdout retained as a sanity check. No time-series lagging or
  gap-corrected split required. Current-state classification format is valid.

## 7. Model Comparison
(Feature set B, 5×3 repeated stratified CV, balanced weights unless noted.)

| Model | Feature Set | Validation Method | Precision | Recall | F1 | ROC-AUC | PR-AUC | Complexity | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| Dummy (stratified) | B | 5×3 CV | 0.175 | 0.162 | 0.168 | 0.507 | 0.171 | trivial | noise floor |
| LogisticRegression | B | 5×3 CV | 0.271 | 0.615 | 0.375 | 0.709 | 0.358 | low, interpretable | poor precision, bad calibration |
| RandomForest | B | 5×3 CV | 0.651 | 0.123 | 0.203 | 0.789 | 0.431 | medium | best ranking; discrete scores, low recall |
| HistGradientBoosting | B | 5×3 CV | 0.454 | 0.338 | 0.386 | 0.767 | 0.420 | medium | **best F1, smooth calibrated-usable score** |

RF ranks marginally higher (roc 0.789 vs 0.767; pr 0.431 vs 0.420) but its
predicted scores are discrete (recall jumps 0.595→0.408 between adjacent
thresholds), so it cannot serve as a continuous risk score and its operating
point is fragile. HGB chosen for smooth score, higher F1 at threshold, and finer
threshold control. Difference is a usability/suite decision, not marginal-metric
chasing.

## 8. Class Imbalance
- Tried: balanced class_weight (LR/RF/HGB) vs unweighted, on feature set B.
- Effect: balanced weights shift the operating point, lifting recall
  substantially (LR rec 0.11→0.615; HGB 0.236→0.338) at lower precision while
  leaving ranking quality (PR-AUC) essentially unchanged. This is a threshold-
  equivalent effect, not a quality gain.
- Rejected: SMOTE and random oversampling/resampling. n=1000 small, 16.2% positive
  is moderate; weighting achieves the recall shift without synthetic-risk or
  out-of-fold leakage. If resampling were ever used it must be train-only; not
  used here.
- Selected: balanced class_weight to favor failure recall as the operating point.

## 9. Threshold Analysis
Default 0.5 is inappropriate: RF recall at 0.5 is only 0.123. Thresholds on
pooled train-only 5-fold CV validation (n=2400, 390 positives):

| Model | thr | Precision | Recall | F1 | FP | FN |
|---|---|---|---|---|---|---|
| HGB | 0.10 | 0.331 | 0.682 | 0.446 | 538 | 124 |
| HGB | **0.15** | **0.358** | **0.638** | **0.459** | 447 | 141 |
| HGB | 0.20 | 0.365 | 0.569 | 0.445 | 386 | 168 |
| HGB | 0.50 | 0.451 | 0.338 | 0.387 | 161 | 258 |
| RF | 0.30 | 0.355 | 0.595 | 0.444 | 422 | 158 |
| LR | 0.60 | 0.316 | 0.485 | 0.382 | 410 | 201 |

Selected threshold: **0.15**, from train-only 5-fold CV F1-max. Trade-off: catches
~64% of failures at ~36% precision; ~22% of normal hours flagged. Threshold
selection never used the test holdout. This is a proposed default; Phase 4 may
move it once real failure/miss costs are known (presented as continuous score).

## 10. Calibration
Inner-validation Brier: HGB 0.1329 (reference constant 0.1361, mean abs cal error
0.18/8bins); RF 0.1192; LR 0.2110 (worse than predicting constant, driven by
balanced weights). With n=1000 and 16% positives, a reliable calibration estimate
is not supportable, and balanced-weight probabilities are inflated. **Output must
be named FAILURE RISK SCORE, not probability.** Probability recalibration
(Platt/isotonic) is deferred to Phase 4 only if more data or a holdout calibration
set justifies it; not reliable on this sample.

## 11. Feature Importance
Permutation importance (HGB, feature set B, AUC-based, 20 repeats):
vibration +0.132, temperature +0.078, motor_temperature +0.057, load +0.046,
pressure +0.033, sound_level +0.031, fan_speed +0.022; negligible/negative:
rotation_speed −0.003, active_power −0.009, current −0.013, oil_level +0.005,
voltage +0.006, gearbox_temperature +0.006.
Statistics only: vibration and temperature dominate; several excluded variables
(motor_temperature, load, sound_level, fan_speed) carry real signal, which is why
feature set B beats A. This is statistical evidence, NOT physical causation — no
failure mechanism is claimed.

## 12. FINAL ML STRATEGY
- Feature set: all 15 raw industrial variables (temperature, vibration, pressure,
  humidity, rotation_speed, voltage, current, oil_level, load, motor_temperature,
  gearbox_temperature, sound_level, fan_speed, reactive_power, active_power).
- Preprocessing: per-train median imputation for robustness; no scaling needed
  for the tree model. Single fitted preprocessing state, reused at inference.
- Feature engineering: none beyond the raw 15. Reject engineered ratios/squares
  (feature set C gave no gain). Phase-1 15-engineered-feature pipeline is
  superseded for the final model by raw 15.
- Failure model: HistGradientBoostingClassifier, class_weight balanced, max_depth 4,
  max_iter 200, seed 42.
- Anomaly representation: same 15-raw-feature representation as failure model,
  for coherence (IsolationForest).
- Prediction formulation: current-state classification (current sensor state →
  failure label). Future-step, long-horizon, RUL rejected — not supported by data.
- Evaluation strategy: stratified 5×3 repeated CV primary; chronological holdout
  sanity check; final reserved 20% test touched once.
- Threshold: 0.15 on the risk score (train-only CV F1-max default), adjustable
  by cost in Phase 4.
- Output terminology: FAILURE RISK SCORE (not calibrated probability).
- Model version strategy: seed 42, feature list fixed to the 15 above (order
  pinned), dataset SHA256 tag recorded; retrain retains this contract.

## 13. Why This Strategy Was Selected
Evidence: (a) all models beat dummy; (b) feature set B clearly outperforms A — the
10 excluded variables are informative, so they are adopted; (c) engineered C adds
no value, so complexity is avoided; (d) HGB gives the highest F1 and the only
smooth, moderately-calibrated continuous score among tree models, enabling an
honest risk score with a chosen operating threshold; (e) threshold 0.15 is derived
from validation only, preserving test integrity; (f) LR rejected for poor
calibration + precision; RF rejected despite best ranking because its discrete
scores make a continuous risk score unusable. Honesty over inflation: signal is
weak and the dataset supports only current-state classification with a
risk-score (not probability) output.

## 14. What Was Rejected
- Feature set C (15 + engineered ratios/squares): no ranking or F1 gain.
- RandomForest as final model: best rank AUC but discrete scores, fragile
  operating point, low recall at default threshold.
- LogisticRegression as final: worst calibration (Brier 0.211 > reference),
  low precision despite good recall.
- SMOTE / random resampling: not needed; weighting achieves recall operating
  shift; small-n synthetic risk.
- Future-step / long-horizon failure prediction: rejected — no failure
  persistence, no temporal structure to exploit.
- RUL estimation: rejected — hourly isolated failures, no run-to-failure
  profiles to estimate remaining life.
- Deep learning: never warranted for n=1000 tabular weak signal; not a candidate.
- Probability calibration (now): rejected as output semantics — unreliable at
  this sample size; deferred, output is risk score.

## 15. Phase 3 Specification (Anomaly Detection)
- Model: IsolationForest on the same 15-raw-feature representation.
- contamination: use validation-derived value (estimate ~0.16; tune on train-only
  CV, not test). Reject current rule-based thresholds (vib>50, temp>200, etc.) as
  unrealistic at dataset scale; replace with model score + a decision threshold
  chosen on validation.
- Preprocessing: reuse fitted per-train median imputation; PipelineState pattern
  from Phase 1 extended to include the 15 raw features. Fitted on train only,
  persisted, applied identically at inference.
- Feature ordering pinned to the 15-list of §12.
- Evaluation: 5×3 repeated stratified CV, report recall/precision at threshold;
  chronological holdout sanity. Test holdout untouched until strategy frozen.

## 16. Phase 4 Specification (Failure-Risk Prediction)
- Model: HistGradientBoostingClassifier(class_weight='balanced', max_depth=4,
  max_iter=200, random_state=42) — final frozen config.
- Input features: exactly the 15 raw industrial variables (§12), pinned order.
- Output: continuous FAILURE RISK SCORE. Decision rule at default threshold 0.15
  (train-only CV F1-max); expose the raw score and let an operator/cost layer set
  the final alert threshold.
- Preprocessing: single fitted median-imputation state per train, persisted via
  PipelineState, reused at inference (no train/serve skew). No engineered features;
  supersedes Phase-1 5-var engineered pipeline for this model.
- Threshold selection methodology: 5-fold CV on train only (F1-max as default;
  threshold may be re-derived from validation if failure/FP costs arrive, never
  from test).
- Evaluation: at minimum accuracy, precision, recall, F1, ROC-AUC, PR-AUC,
  confusion matrix on the frozen test holdout, exactly once after strategy is frozen.
- Persistence: sklearn pickle of fitted estimator + pipeline state, version tagged
  with dataset SHA256 (7796bdba…). Refit reproduces this contract.

## 17. Files Created/Modified
| File | Reason |
|---|---|
| `backend/scripts/experiments/audit_data.py` | Step 1 analytical re-audit |
| `backend/scripts/experiments/experiment_compare.py` | Feature-set × model × imbalance harness; carves reserved test |
| `backend/scripts/experiments/experiment_stage2.py` | Threshold, calibration, permutation importance, leakage, temporal |
| `backend/scripts/experiments/experiment_final.py` | Independent reproduction of frozen strategy + single test touch |
| `backend/experiments_out/` | JSON results: reserved_test.csv, experiment_results.json, stage2_results.json, final_strategy_result.json, PHASE2_REPORT.md |

No production inference code changed. No RAG/LLM/frontend/backend services modified.

## 18. Experiments Executed
- `python scripts/experiments/audit_data.py`
- `python scripts/experiments/experiment_compare.py` (reserved test written)
- `python scripts/experiments/experiment_stage2.py`
- `python scripts/experiments/experiment_final.py`
Results recorded in the four JSON artifacts. Seeds: 42 throughout; splits 5×3 CV,
stratifed 80/20 reserved test. Full metric tables in §4, §6, §7, §9.

## 19. Self-Validation
1. No target leakage — PASS (weak corr, no collinear/derived features, no future dep)
2. Test not used for threshold tuning — PASS (threshold from train-only CV)
3. Preprocessing fitted on train only — PASS (median on train; scaler only where used, per fold)
4. No future info into past — PASS (hourly independent; chronological verify)
5. Imbalance handling train-only — PASS (class_weight only, no resampling)
6. Every metric matches stated split — PASS (documented per split)
7. Final experiment reproduced — PASS (experiment_final.py fresh rerun: threshold 0.15, rec 0.562, pr 0.414)
8. Feature list matches experiment — PASS (15 raw, pinned order)
9. Feature ordering — PASS
10. Seeds/config — PASS (seed 42; config frozen)
11. No accidental feature inc/exc — PASS (explicit ALL15)
12. No unsupported claims — PASS (weak signal stated; risk score, no probability, no causation)
13. Recommendation follows evidence — PASS (HGB over LR/RF justified by score usability + F1, not marginal metric)
No methodological defect remains.

## 20. Remaining Ambiguities
- Exact physical meaning of `machine_failure` label and failure mechanism: UNKNOWN/UNVERIFIED (class D).
- Optimal operating threshold without real failure/miss cost values: unresolved; F1-max default flagged.
- Recommended contamination value for anomaly IsolationForest: estimated, not confirmed.
- Dataset provenance lineage (UCI → CSV): UNKNOWN/UNVERIFIED; UCI does not natively contain this telemetry or labels.

## 21. Risks
- Small n (1000), weak signal (max |corr| 0.18): generalization ceiling modest; strong predictive claim not justified.
- Chosen threshold flags ~22-24% of normal hours (high FP burden) to reach ~60% recall. False-positive load material; cost layer must weigh.
- Balanced-weight probabilities inflated → output must not be read as probabilities.
- Binary label semantics unknown → model performance against an unverified label is inherently limited.

## 22. Acceptance Checklist
- Dataset analytically re-verified — PASS
- Current 5-feature baseline measured — PASS (set A)
- All 15 available variables evaluated — PASS (set B)
- Feature-set comparison performed — PASS (A/B/C)
- Leakage investigation completed — PASS
- Temporal structure investigated — PASS
- Random/temporal evaluation strategy established — PASS
- Baseline classifier evaluated — PASS (dummy)
- Multiple appropriate model families compared — PASS (LR/RF/HGB)
- Class imbalance investigated — PASS (weighted vs none; resampling rejected)
- Precision/recall tradeoff evaluated — PASS
- ROC-AUC and PR-AUC reported — PASS
- Confusion matrices reported — PASS
- Threshold behavior investigated — PASS
- Threshold selected without test contamination — PASS
- Probability calibration investigated / deemed unreliable — PASS (risk score)
- Feature importance investigated — PASS
- Model complexity considered — PASS
- Final feature set selected with evidence — PASS (15 raw)
- Final model family selected with evidence — PASS (HGB)
- Final prediction formulation selected with evidence — PASS (current-state)
- Final anomaly-feature strategy recommended — PASS (same 15)
- Phase 3 requirements defined — PASS
- Phase 4 requirements defined — PASS
- All experiments reproducible — PASS (seeded, hash-tagged)
- Final selected experiment independently reproduced — PASS
- No unresolved methodological defect — PASS
- No unsupported scientific claims — PASS
All PASS. No NOT APPLICABLE items.

## 23. Final Verdict
Phase 2: **PASS WITH NON-CRITICAL LIMITATIONS**. The final ML strategy is frozen:
HistGradientBoosting (balanced) on the 15 raw industrial variables, current-state
classification, output as FAILURE RISK SCORE, threshold 0.15 selected on
train-only validation, 5×3 repeated-stratified-CV evaluation with a single frozen
test holdout (acc 0.73, rec 0.562, f1 0.40, roc 0.789, pr 0.414 at threshold 0.15).
Phase 3 (anomaly) and Phase 4 (failure-risk) may begin per the specifications in
§15 and §16. Residual limits are the honest consequences of a 1000-row,
weak-signal, unverified-label dataset — not inflated claims to be hidden.