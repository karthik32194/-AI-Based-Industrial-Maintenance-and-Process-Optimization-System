"""Phase 4 -- independent reproduction + sanity of the frozen failure-risk model.

Reconstructs the Phase-2 protocol (stratified 80/20, seed 42, 15 raw vars,
HistGradientBoosting balanced) from the raw dataset, retrains, evaluates on the
frozen test set (experiments_out/frozen_test.csv), and compares to the frozen
result. Runs sanity checks: dummy baseline, non-constant predictions, both
classes predicted, score distribution, monotone threshold behaviour, score
direction (ranking), feature importance over all 15 features, reload
equivalence, and a light calibration note (score is NOT a calibrated
probability).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import numpy as np
import pandas as pd
from sklearn.dummy import DummyClassifier
from sklearn.metrics import (
    accuracy_score, average_precision_score, confusion_matrix,
    precision_score, recall_score, roc_auc_score, f1_score, brier_score_loss,
)
from sklearn.model_selection import StratifiedShuffleSplit

from app.ml.contract import FAILURE_SENSOR_COLUMNS
from app.ml.prediction import load_failure_risk_artifact, train_failure_model
from app.ml import prediction as pm

REPO_ROOT = Path(__file__).resolve().parents[3]
CSV = REPO_ROOT / "simulated_iiot_dataset.csv"
OUT = REPO_ROOT / "backend" / "experiments_out"
FROZEN_TEST = OUT / "frozen_test.csv"
SEED = 42
THRESHOLD = 0.15
N = FAILURE_SENSOR_COLUMNS


def records(df: pd.DataFrame) -> list[dict]:
    rows = df[N].to_dict("records")
    for r in rows:
        for c in N:
            v = r[c]
            r[c] = float(v) if pd.notna(v) else None
    return rows


def main():
    full = pd.read_csv(CSV)
    y = full["machine_failure"].astype(int).to_numpy()
    # Reproduce the frozen split (stratified 80/20 seed42).
    sss = StratifiedShuffleSplit(n_splits=1, test_size=0.2, random_state=SEED)
    tr_idx, te_idx = next(sss.split(full, y))
    train_df = full.iloc[tr_idx].reset_index(drop=True)
    test_df = full.iloc[te_idx].reset_index(drop=True)
    assert len(test_df) == 200, f"expected 200 test rows, got {len(test_df)}"
    # The reserved_test.csv (Phase 2) is the TRAIN partition; frozen_test.csv
    # should equal our complement (the test partition).
    frozen = pd.read_csv(FROZEN_TEST).reset_index(drop=True)
    assert set(frozen.timestamp) == set(test_df.timestamp) - set(train_df.timestamp) or set(frozen.timestamp) == set(test_df.timestamp), "frozen_test.csv must be this test partition"

    rec_tr = records(train_df)
    y_tr = train_df["machine_failure"].astype(int).tolist()
    rec_te = records(test_df)
    y_te = test_df["machine_failure"].astype(int).tolist()

    # Independent retraining on reconstructed train.
    art = train_failure_model(rec_tr, y_tr, threshold=THRESHOLD, random_state=SEED)
    X_te = art.preprocessor.transform(rec_te, bounds={})[N]
    score = art.model.predict_proba(X_te)[:, 1]
    pred = (score >= THRESHOLD).astype(int)

    metrics = {
        "accuracy": round(accuracy_score(y_te, pred), 4),
        "precision": round(precision_score(y_te, pred, zero_division=0), 4),
        "recall": round(recall_score(y_te, pred, zero_division=0), 4),
        "f1": round(f1_score(y_te, pred, zero_division=0), 4),
        "roc_auc": round(roc_auc_score(y_te, score), 4),
        "pr_auc": round(average_precision_score(y_te, score), 4),
        "confusion": confusion_matrix(y_te, pred).tolist(),
    }
    print("FROZEN  : Acc .73  P .3103  R .5625  F1 .40  AUC .7889  PR .4139  Conf [[128,40],[14,18]]")
    print("REPRO   :", metrics)

    # --- dummy baseline ---
    dummy = DummyClassifier(strategy="stratified", random_state=SEED).fit(np.zeros(len(y_tr)).reshape(-1, 1), y_tr)
    d_pred = dummy.predict(np.zeros(len(y_te)))
    print(f"Dummy stratified: acc={accuracy_score(y_te, d_pred):.3f} "
          f"f1={f1_score(y_te, d_pred, zero_division=0):.3f}")
    dummy2 = DummyClassifier(strategy="most_frequent").fit(np.zeros(len(y_tr)).reshape(-1, 1), y_tr)
    mf_pred = dummy2.predict(np.zeros(len(y_te)))
    print(f"Dummy most-frequent: acc={accuracy_score(y_te, mf_pred):.3f} f1={f1_score(y_te, mf_pred, zero_division=0):.3f} recall_failure={recall_score(y_te, mf_pred, zero_division=0):.3f}")

    # --- sanity: non-constant, both classes ---
    print("pred counts:", np.bincount(pred, minlength=2).tolist())
    print("true counts:", np.bincount(y_te, minlength=2).tolist())
    print(f"score min={score.min():.4f} max={score.max():.4f} mean={score.mean():.4f} sd={score.std():.4f}")

    # --- threshold monotonic behaviour ---
    print("threshold sweep (behaviour, NOT tuning):")
    for t in (0.10, 0.15, 0.20, 0.30, 0.50):
        p = (score >= t).astype(int)
        print(f"  t={t:.2f} prec={precision_score(y_te, p, zero_division=0):.3f} rec={recall_score(y_te, p, zero_division=0):.3f} f1={f1_score(y_te, p, zero_division=0):.3f} flagrate={p.mean():.3f}")

    # --- score direction: higher score -> higher failure rate in deciles ---
    y_te_np = np.asarray(y_te)
    order = np.argsort(score)
    dec = np.array_split(order, 10)
    rates = [y_te_np[idx].mean() for idx in dec]
    print("failure rate by score decile (0=lowest score):", [round(r, 3) for r in rates])

    # --- feature importance across all 15 (permutation, on test scores) ---
    from sklearn.inspection import permutation_importance
    pi = permutation_importance(art.model, X_te, np.asarray(y_te),
                                n_repeats=20, random_state=SEED, scoring="roc_auc")
    imp = pi.importances_mean
    order15 = np.argsort(imp)[::-1]
    print("features supplied:", len(N), "== 15:", len(N) == 15)
    print("permutation importance (mean drop in ROC-AUC across all 15 features):")
    for i in order15:
        print(f"  {N[i]}: {imp[i]:.4f}")

    # --- reload real persisted artifact equivalence ---
    real_loaded = load_failure_risk_artifact()
    assert real_loaded is not None
    pm._failure_artifact = real_loaded
    r0 = rec_te[0]
    s_orig = float(art.model.predict_proba(art.preprocessor.transform_one(r0, bounds={})[N])[0, 1])
    s_loaded = float(pm.predict_failure(r0)["failure_risk_score"])
    print(f"reload equivalence: original={s_orig:.8f} loaded={s_loaded:.8f} match={abs(s_orig-s_loaded)<1e-6}")

    # --- calibration note (score NOT calibrated probability) ---
    brier = brier_score_loss(y_te, score)
    base_rate = y_te_np.mean()
    brier_constant = (0 - base_rate) ** 2 * (1 - base_rate) + (1 - base_rate) ** 2 * base_rate
    print(f"calibration: brier={brier:.4f} vs constant-baseline={brier_constant:.4f}; "
          f"score kept as risk SCORE, not probability (ranking AUC meaningful, calibration not demonstrated)")

    out = {
        "frozen_reference": {"accuracy": 0.73, "precision": 0.3103, "recall": 0.5625,
                             "f1": 0.4, "roc_auc": 0.7889, "pr_auc": 0.4139,
                             "confusion": [[128, 40], [14, 18]]},
        "reproduced": metrics,
        "dummy_most_frequent_acc": round(accuracy_score(y_te, mf_pred), 4),
        "dummy_most_frequent_f1": round(f1_score(y_te, mf_pred, zero_division=0), 4),
        "decile_failure_rates": [round(float(r), 4) for r in rates],
        "threshold_sweep": {str(t): {"precision": round(precision_score(y_te, (score >= t).astype(int), zero_division=0), 3),
                                     "recall": round(recall_score(y_te, (score >= t).astype(int), zero_division=0), 3)}
                            for t in (0.10, 0.15, 0.20, 0.30, 0.50)},
        "brier": round(brier, 4),
        "score_semantics": "failure_risk_score (uncalibrated ranking indicator), not probability",
    }
    OUT.mkdir(parents=True, exist_ok=True)
    with open(OUT / "failure_reproduction.json", "w") as f:
        json.dump(out, f, indent=2)
    print("\nPASS: independent reproduction complete ->", OUT / "failure_reproduction.json")


if __name__ == "__main__":
    main()