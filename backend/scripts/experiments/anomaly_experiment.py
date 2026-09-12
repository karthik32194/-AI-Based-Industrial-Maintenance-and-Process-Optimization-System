"""Phase 3 -- Isolation Forest anomaly experiment (controlled compare).

Questions:
  1. Representation: raw15 vs scaled15 vs Phase-1 engineered15 vs raw5.
  2. Training population: all obs vs machine_failure==0 only.
  3. Contamination sensitivity.
  4. Stability across seeds / repeated splits.
  5. Feature contribution among flagged.

IMPORTANT: machine_failure is NOT anomaly ground truth. It is used ONLY as a
SECONDARY sanity signal (label overlap / ranking). Primary evaluation is
unsupervised: flagged rate, score distribution, stability.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.metrics import roc_auc_score, average_precision_score
from sklearn.model_selection import StratifiedShuffleSplit
from sklearn.preprocessing import StandardScaler

from app.ml.features import engineer_features
from app.ml.preprocessing import FittedPreprocessor

REPO_ROOT = Path(__file__).resolve().parents[3]
CSV = REPO_ROOT / "simulated_iiot_dataset.csv"
OUT = REPO_ROOT / "backend" / "experiments_out"
OUT.mkdir(parents=True, exist_ok=True)
SEED = 42
TEST_FRAC = 0.20

ALL15 = [
    "temperature", "vibration", "pressure", "humidity", "rotation_speed",
    "voltage", "current", "oil_level", "load", "motor_temperature",
    "gearbox_temperature", "sound_level", "fan_speed", "reactive_power",
    "active_power",
]


def rep_matrix(train_df: pd.DataFrame, rep: str) -> tuple[np.ndarray, dict]:
    if rep == "raw15":
        X = train_df[ALL15].to_numpy(float)
        return X, {"feats": ALL15, "scale": "raw"}
    if rep == "scaled15":
        X = train_df[ALL15].to_numpy(float)
        return X, {"feats": ALL15, "scale": "std"}
    if rep == "raw5":
        f5 = ["temperature", "vibration", "pressure", "rotation_speed", "active_power"]
        return train_df[f5].to_numpy(float), {"feats": f5, "scale": "raw"}
    if rep == "eng15":  # Phase-1 engineered 15 from canonical mapping
        recs = train_df[ALL15].rename(columns={"rotation_speed": "rpm",
                                               "active_power": "power_consumption"})
        recs = recs.astype(float).to_dict("records")
        pp = FittedPreprocessor.fit(recs)
        feat = engineer_features(pp.transform(recs))
        names = feat.columns.tolist()
        return feat.to_numpy(float), {"feats": names, "scale": "engineered"}
    raise ValueError(rep)


def score_of(model, X):
    return -model.decision_function(X)  # higher = more abnormal


def flag_rate(fit_X, X, rep, contam, pop, seed):
    """Fit IF, return (secondary AUROC, AP, flagged fraction, stability)."""
    if rep == "scaled15":
        sc = StandardScaler().fit(fit_X)
        fit_X, X = sc.transform(fit_X), sc.transform(X)
    m = IsolationForest(n_estimators=300, contamination=contam,
                        random_state=seed, n_jobs=-1)
    m.fit(fit_X)
    s = score_of(m, X)
    thr = np.quantile(score_of(m, fit_X), 1 - contam)
    pred = (s >= thr).astype(int)
    return m, s, pred, thr


def main():
    df = pd.read_csv(CSV)
    y = df["machine_failure"].to_numpy()
    ts = pd.to_datetime(df["timestamp"])
    sss = StratifiedShuffleSplit(n_splits=1, test_size=TEST_FRAC, random_state=SEED)
    tr_idx, te_idx = next(sss.split(df, y))
    train_df, test_df = df.iloc[tr_idx], df.iloc[te_idx]
    tr_y, te_y = y[tr_idx], y[te_idx]
    report = {"meta": {"seed": SEED, "test_frac": TEST_FRAC,
                       "dataset_hash": "7796bdba32a09391cd76b09a04f0e72cdfa5545037d01b2064b2948ff3510207"}}

    # ---- 1. REPRESENTATION comparison (training pop = all, contam 0.10) ----
    print("=== REPRESENTATION (pop=ALL, contam=0.10) ===")
    rep_rows = []
    for rep in ("raw5", "raw15", "scaled15", "eng15"):
        Xtr, meta = rep_matrix(train_df, rep)
        Xte, _ = rep_matrix(test_df, rep)
        m, s, pred, thr = flag_rate(Xtr, Xte, rep, 0.10, "all", SEED)
        auroc = roc_auc_score(te_y, s)
        ap = average_precision_score(te_y, s)
        flag = float(pred.mean())
        rep_rows.append({"representation": rep, "n_feats": meta["feats"].__len__(),
                         "scale": meta["scale"], "test_auroc_sanity": round(auroc, 3),
                         "test_ap_sanity": round(ap, 3), "flagged_rate": round(flag, 3)})
        print(f"  {rep:9s} n={len(meta['feats']):2d} test_auroc={auroc:.3f} "
              f"test_ap={ap:.3f} flagged={flag:.3f}")
    report["representation"] = rep_rows

    # ---- 2. TRAINING POPULATION (scaled15? raw15, contam 0.10) ----
    print("\n=== TRAINING POPULATION (raw15, contam=0.10) ===")
    Xtr = train_df[ALL15].to_numpy(float)
    Xte = test_df[ALL15].to_numpy(float)
    for pop in ("all", "normal_only"):
        fitX = Xtr if pop == "all" else Xtr[tr_y == 0]
        m, s, pred, thr = flag_rate(fitX, Xte, "raw15", 0.10, pop, SEED)
        auroc = roc_auc_score(te_y, s); ap = average_precision_score(te_y, s)
        print(f"  {pop:11s} fit_n={len(fitX)} test_auroc={auroc:.3f} test_ap={ap:.3f} "
              f"flagged={pred.mean():.3f}")

    # ---- 3. CONTAMINATION sensitivity (raw15, pop=ALL) ----
    print("\n=== CONTAMINATION SENSITIVITY (raw15, pop=ALL, test) ===")
    contam_rows = []
    for c in (0.03, 0.05, 0.08, 0.10, 0.15, float(tr_y.mean())):
        m, s, pred, thr = flag_rate(Xtr, Xte, "raw15", c, "all", SEED)
        au = roc_auc_score(te_y, s); ap = average_precision_score(te_y, s)
        over_true = float(((pred == 1) & (te_y == 1)).sum())
        true_pos = int(te_y.sum())
        contam_rows.append({"contam": round(float(c), 4), "flagged": round(float(pred.mean()), 3),
                            "auroc_sanity": round(au, 3), "ap_sanity": round(ap, 3),
                            "flagged_failures_overlap": int(over_true), "true_pos": true_pos})
        print(f"  contam={c:.3f} flagged={pred.mean():.3f} auroc={au:.3f} ap={ap:.3f} "
              f"flagged_and_failure={int(over_true)}/{true_pos}")
    report["contamination"] = contam_rows

    # ---- 4. STABILITY across seeds (raw15, pop=ALL, contam0.10, test) ----
    print("\n=== STABILITY ACROSS SEEDS (raw15, pop=ALL, contam=0.10) ===")
    flags = []
    for s in range(0, 10):
        _, sp, predp, _ = flag_rate(Xtr, Xte, "raw15", 0.10, "all", seed=42 + s)
        flags.append(float(predp.mean()))
    print(f"  flagged-rate across seeds: {[round(f,3) for f in flags]}")
    print(f"  mean={np.mean(flags):.3f} sd={np.std(flags):.3f}")
    report["stability"] = {"flagged_rates_seeds": [round(f, 3) for f in flags],
                           "mean": round(float(np.mean(flags)), 3), "sd": round(float(np.std(flags)), 3)}

    # ---- 5. FEATURE CONTRIBUTION among flagged vs unflagged (z-profile) ----
    print("\n=== FEATURE CONTRIBUTION (raw15, contam=0.10): standardized mean of flagged vs unflagged ===")
    _, s, predp, _ = flag_rate(Xtr, Xte, "raw15", 0.10, "all", SEED)
    z = (Xte - Xte.mean(0)) / (Xte.std(0) + 1e-9)
    flagged_z = z[predp == 1].mean(0)
    unflagged_z = z[predp == 0].mean(0)
    contribution = []
    for i, col in enumerate(ALL15):
        d = flagged_z[i] - unflagged_z[i]
        contribution.append({"feature": col, "flagged_mean_z": round(float(flagged_z[i]), 3),
                             "unflagged_mean_z": round(float(unflagged_z[i]), 3),
                             "delta_z": round(float(d), 3)})
        print(f"  {ALL15[i]:20s} flagged_z={flagged_z[i]:+.3f} unflagged_z={unflagged_z[i]:+.3f} "
              f"delta={d:+.3f}")
    contribution.sort(key=lambda r: -abs(r["delta_z"]))
    report["feature_contribution"] = contribution

    with open(OUT / "anomaly_experiment.json", "w") as f:
        json.dump(report, f, indent=2, default=str)
    print(f"\nSaved {OUT / 'anomaly_experiment.json'}")


if __name__ == "__main__":
    main()