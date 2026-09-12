"""Phase 2 -- independent reproduction of the FINAL selected strategy, then a
single first-touch evaluation on the previously-frozen reserved test holdout.

Final strategy being frozen:
  * Feature set B = all 15 raw industrial variables (no engineered additions).
  * Model         = HistGradientBoosting, class_weight='balanced', seed 42.
  * Preprocess    = per-train median imputation (robustness; 0 nulls here).
  * Threshold     = validation F1-max, derived from 5-fold CV on TRAIN ONLY.
  * Output        = FAILURE RISK SCORE (not literal calibrated probability).

Test holdout (200 rows) was carved + written in experiment_compare.py and has
NOT been used for any choice. This script touches it exactly once.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, average_precision_score, confusion_matrix,
)
from sklearn.model_selection import StratifiedShuffleSplit, StratifiedKFold

REPO_ROOT = Path(__file__).resolve().parents[3]
CSV = REPO_ROOT / "simulated_iiot_dataset.csv"
OUT = REPO_ROOT / "backend" / "experiments_out"
SEED = 42
TEST_FRAC = 0.20
N_SPLITS = 5

ALL15 = [
    "temperature", "vibration", "pressure", "humidity", "rotation_speed",
    "voltage", "current", "oil_level", "load", "motor_temperature",
    "gearbox_temperature", "sound_level", "fan_speed", "reactive_power",
    "active_power",
]


def main():
    df = pd.read_csv(CSV)
    y = df["machine_failure"].to_numpy()
    # identical split to experiment_compare/stage2 (same seed, frac)
    sss = StratifiedShuffleSplit(n_splits=1, test_size=TEST_FRAC, random_state=SEED)
    tr_idx, te_idx = next(sss.split(df, y))
    Xtr, Xte = df.iloc[tr_idx][ALL15], df.iloc[te_idx][ALL15]
    ytr, yte = y[tr_idx], y[te_idx]
    print(f"train {len(tr_idx)} (pos {ytr.mean():.3f}) / test {len(te_idx)} "
          f"(pos {yte.mean():.3f}) -- SAME split as reserved_test.csv")

    # ---- threshold selection on TRAIN only via 5-fold CV ----
    skf = StratifiedKFold(n_splits=N_SPLITS, shuffle=True, random_state=SEED)
    val_y, val_p = [], []
    for a, b in skf.split(Xtr, ytr):
        m = HistGradientBoostingClassifier(
            max_iter=200, max_depth=4, class_weight="balanced", random_state=SEED)
        m.fit(Xtr.iloc[a], ytr[a])
        val_y.append(ytr[b]); val_p.append(m.predict_proba(Xtr.iloc[b])[:, 1])
    val_y = np.concatenate(val_y); val_p = np.concatenate(val_p)
    best_t, best_f1 = 0.5, -1.0
    for t in np.arange(0.05, 0.96, 0.05):
        f1 = f1_score(val_y, (val_p >= t).astype(int))
        if f1 > best_f1:
            best_f1, best_t = f1, t
    print(f"threshold selected (val F1-max) = {best_t:.2f}, val F1 = {best_f1:.3f}")

    # ---- final model on full train ----
    final = HistGradientBoostingClassifier(
        max_iter=200, max_depth=4, class_weight="balanced", random_state=SEED)
    final.fit(Xtr, ytr)
    proba_te = final.predict_proba(Xte)[:, 1]
    pred = (proba_te >= best_t).astype(int)

    cm = confusion_matrix(yte, pred)
    metrics = {
        "threshold": round(float(best_t), 3),
        "accuracy": round(accuracy_score(yte, pred), 3),
        "precision": round(precision_score(yte, pred), 3),
        "recall": round(recall_score(yte, pred), 3),
        "f1": round(f1_score(yte, pred), 3),
        "roc_auc": round(roc_auc_score(yte, proba_te), 3),
        "pr_auc": round(average_precision_score(yte, proba_te), 3),
        "confusion": cm.tolist(),
        "tp_fp_fn_tn": [int(cm[1, 1]), int(cm[0, 1]), int(cm[1, 0]), int(cm[0, 0])],
        "features": ALL15,
        "model": "HistGradientBoostingClassifier(balanced)",
        "split": "stratified 80/20 seed42 (reserved_test.csv)",
        "threshold_selection": "5-fold CV F1-max on train ONLY",
    }
    print(f"FINAL TEST (touched once, thr={best_t:.2f}):")
    print(json.dumps(metrics, indent=2))

    with open(OUT / "final_strategy_result.json", "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"Saved {OUT / 'final_strategy_result.json'}")


if __name__ == "__main__":
    main()