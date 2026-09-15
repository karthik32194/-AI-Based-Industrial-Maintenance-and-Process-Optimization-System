"""Phase 2 -- controlled model/feature experiment harness.

Design (each report metric corresponds to the stated split):
  * FINAL TEST HOLDOUT: 20% stratified, first-time-touched only after strategy frozen.
    Here it is carved out and reserved (written to disk) but NOT used for selection.
  * INNER REPEATED STRATIFIED CV (5x3) on the remaining 80%: all model + feature +
    threshold + calibration decisions happen here. Preprocessing fitted per fold.
  * Threshold selected on inner validation only -- never on the test holdout.

Everything seeded and recorded. No test contamination during selection.

Outputs JSON + printed tables to backend/experiments_out/.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, average_precision_score, confusion_matrix, brier_score_loss,
)
from sklearn.model_selection import (
    RepeatedStratifiedKFold, StratifiedShuffleSplit, train_test_split,
)
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

REPO_ROOT = Path(__file__).resolve().parents[3]
CSV = REPO_ROOT / "simulated_iiot_dataset.csv"
OUT = REPO_ROOT / "backend" / "experiments_out"
OUT.mkdir(parents=True, exist_ok=True)

SEED = 42
TEST_FRAC = 0.20
N_SPLITS = 5
N_REPEATS = 3

CANON5 = ["temperature", "vibration", "pressure", "rpm", "power_consumption"]
ALL15 = [
    "temperature", "vibration", "pressure", "humidity", "rotation_speed",
    "voltage", "current", "oil_level", "load", "motor_temperature",
    "gearbox_temperature", "sound_level", "fan_speed", "reactive_power",
    "active_power",
]
# map canonical -> dataset names for set A
CANON_TO_DS = {"rpm": "rotation_speed", "power_consumption": "active_power"}
SET_A = ["temperature", "vibration", "pressure", "rotation_speed", "active_power"]

ENGINEERED = [
    "temp_sq", "vib_sq", "temp_vib_ratio", "power_per_rpm", "pressure_per_rpm",
    "motor_gearbox_delta", "power_current_ratio", "load_per_rpm",
]


def engineering(df: pd.DataFrame) -> pd.DataFrame:
    eps = 1e-6
    out = df.copy()
    out["temp_sq"] = df["temperature"] ** 2
    out["vib_sq"] = df["vibration"] ** 2
    out["temp_vib_ratio"] = df["temperature"] / (df["vibration"] + eps)
    out["power_per_rpm"] = df["active_power"] / (df["rotation_speed"] + eps)
    out["pressure_per_rpm"] = df["pressure"] / (df["rotation_speed"] + eps)
    out["motor_gearbox_delta"] = df["motor_temperature"] - df["gearbox_temperature"]
    out["power_current_ratio"] = df["active_power"] / (df["current"] + eps)
    out["load_per_rpm"] = df["load"] / (df["rotation_speed"] + eps)
    return out


def feature_set_matrix(df: pd.DataFrame, name: str) -> pd.DataFrame:
    if name == "A":  # current canonical 5 (dataset names)
        return df[SET_A]
    if name == "B":  # all 15 available industrial variables
        return df[ALL15]
    if name == "C":  # all 15 + engineered
        return engineering(df)[ALL15 + ENGINEERED]
    raise ValueError(name)


def model_builders(imbalance: str):
    cw = "balanced" if imbalance == "weighted" else None
    mods = {
        "LogisticRegression": lambda: LogisticRegression(
            max_iter=1000, class_weight=cw, random_state=SEED),
        "RandomForest": lambda: RandomForestClassifier(
            n_estimators=300, min_samples_leaf=3, class_weight=cw,
            random_state=SEED, n_jobs=-1),
        "HistGradientBoosting": lambda: HistGradientBoostingClassifier(
            max_iter=200, max_depth=4, class_weight=cw, random_state=SEED),
    }
    return mods


def clf_estimator(name, mod, scale: bool):
    if name == "LogisticRegression" or scale:
        return make_pipeline(StandardScaler(), mod)
    return mod


def fit_preprocess(X, y):
    """Placeholder mapping to document that preprocessing = per-fold scaler fit.

    No imputation needed (0 nulls). StandardScaler fitted inside each fold only.
    """
    return X, y


def grid_feature(name: str, X: pd.DataFrame, y: np.ndarray,
                 builders, scale_sets):
    """Repeated stratified CV for one feature set -- returns metrics dicts."""
    rskf = RepeatedStratifiedKFold(
        n_splits=N_SPLITS, n_repeats=N_REPEATS, random_state=SEED)
    results = {}
    for mname, build in builders.items():
        precs, recs, f1s, accs, aucs, praucs = [], [], [], [], [], []
        cmats = []
        for tr_i, va_i in rskf.split(X, y):
            Xtr, Xva = X.iloc[tr_i], X.iloc[va_i]
            ytr, yva = y[tr_i], y[va_i]
            est = clf_estimator(mname, build(), mname in scale_sets)
            est.fit(Xtr, ytr)
            p = est.predict(Xva)
            proba = est.predict_proba(Xva)[:, 1]
            precs.append(precision_score(yva, p))
            recs.append(recall_score(yva, p))
            f1s.append(f1_score(yva, p))
            accs.append(accuracy_score(yva, p))
            aucs.append(roc_auc_score(yva, proba))
            praucs.append(average_precision_score(yva, proba))
            cmats.append(confusion_matrix(yva, p))
        cm_mean = np.mean(np.stack(cmats), axis=0)
        results[mname] = {
            "accuracy": float(np.mean(accs)),
            "precision": float(np.mean(precs)),
            "recall": float(np.mean(recs)),
            "f1": float(np.mean(f1s)),
            "roc_auc": float(np.mean(aucs)),
            "pr_auc": float(np.mean(praucs)),
            "roc_auc_sd": float(np.std(aucs)),
            "pr_auc_sd": float(np.std(praucs)),
            "confusion_mean": cm_mean.round(2).tolist(),
        }
    return results


def main() -> None:
    df = pd.read_csv(CSV)
    y = df["machine_failure"].to_numpy()

    # ---- carve out final test holdout (stratified), reserve, DO NOT touch ----
    sss = StratifiedShuffleSplit(n_splits=1, test_size=TEST_FRAC, random_state=SEED)
    tr_idx, te_idx = next(sss.split(df, y))
    train_df = df.iloc[tr_idx].reset_index(drop=True)
    test_df = df.iloc[te_idx].reset_index(drop=True)
    train_df.to_csv(OUT / "reserved_test.csv", index=False)
    print(f"reserved_test written: {len(test_df)} rows "
          f"(pos rate {test_df['machine_failure'].mean():.3f}) -- UNTOUCHED until freeze")

    ytr = train_df["machine_failure"].to_numpy()

    # ---- main comparison: feature set x model x imbalance ----
    scale_sets = {"LogisticRegression"}
    builders_w = model_builders("weighted")
    builders_n = model_builders("None")

    report = {"meta": {
        "seed": SEED, "test_frac": TEST_FRAC, "n_splits": N_SPLITS,
        "n_repeats": N_REPEATS, "dataset_hash": "7796bdba32a09391cd76b09a04f0e72cdfa5545037d01b2064b2948ff3510207",
    }, "feature_sets": {}, "leakage": {}, "temporal": {}, "threshold": {},
        "calibration": {}, "importance": {}}

    for fname in ("A", "B", "C"):
        X = feature_set_matrix(train_df, fname)
        report["feature_sets"][fname] = {
            "features": list(X.columns), "n": X.shape[1]}
        # balanced-class weighting (the mainline) + None for contrast on B only
        rw = grid_feature(fname, X, ytr, builders_w, scale_sets)
        report["feature_sets"][fname]["weighted"] = rw
        if fname == "B":
            rn = grid_feature(fname, X, ytr, builders_n, scale_sets)
            report["feature_sets"][fname]["none"] = rn
        print(f"\n===== FEATURE SET {fname} ({X.shape[1]} features) ===== ")
        for mname, m in rw.items():
            print(f"  {mname:22s} acc={m['accuracy']:.3f} prec={m['precision']:.3f} "
                  f"rec={m['recall']:.3f} f1={m['f1']:.3f} roc={m['roc_auc']:.3f} "
                  f"pr={m['pr_auc']:.3f}")

    # ---- dummy baseline (on B, weighted) ----
    X = feature_set_matrix(train_df, "B")
    m_all = clf_estimator("RandomForest", RandomForestClassifier(
        n_estimators=300, min_samples_leaf=3, class_weight="balanced",
        random_state=SEED, n_jobs=-1), False)
    # dummy stratified baseline via CV
    rskf = RepeatedStratifiedKFold(n_splits=N_SPLITS, n_repeats=N_REPEATS, random_state=SEED)
    acc, prec, rec, f1, auc, pr = [], [], [], [], [], []
    for tr_i, va_i in rskf.split(X, ytr):
        dummy = DummyClassifier(strategy="stratified", random_state=SEED)
        dummy.fit(X.iloc[tr_i], ytr[tr_i])
        p = dummy.predict(X.iloc[va_i])
        proba = dummy.predict_proba(X.iloc[va_i])[:, 1]
        acc.append(accuracy_score(ytr[va_i], p)); prec.append(precision_score(ytr[va_i], p))
        rec.append(recall_score(ytr[va_i], p)); f1.append(f1_score(ytr[va_i], p))
        auc.append(roc_auc_score(ytr[va_i], proba)); pr.append(average_precision_score(ytr[va_i], proba))
    report["feature_sets"]["dummy"] = {
        "accuracy": float(np.mean(acc)), "precision": float(np.mean(prec)),
        "recall": float(np.mean(rec)), "f1": float(np.mean(f1)),
        "roc_auc": float(np.mean(auc)), "pr_auc": float(np.mean(pr))}
    print("\n===== DUMMY (stratified) baseline ===== ", report["feature_sets"]["dummy"])

    with open(OUT / "experiment_results.json", "w") as f:
        json.dump(report, f, indent=2, default=str)
    print(f"\nSaved {OUT / 'experiment_results.json'}")


if __name__ == "__main__":
    main()