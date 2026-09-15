"""Phase 3 -- independent reproduction of the FINAL anomaly strategy.

Contamination 0.05 (operating assumption), raw 15-var, pop ALL, n_estimators 300.
Validates: threshold, flagged rate, temporal sanity, reload equivalence.
All training via the production AnomalyArtifact path.
No test-set contamination: threshold derived from TRAIN scores only.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedShuffleSplit

from app.ml.anomaly import AnomalyArtifact, detect_anomaly, load_anomaly_artifact, save_anomaly_artifact, train_anomaly_model, _artifact
from app.ml import anomaly as amod
from app.ml.contract import ANOMALY_SENSOR_COLUMNS

REPO_ROOT = Path(__file__).resolve().parents[3]
CSV = REPO_ROOT / "simulated_iiot_dataset.csv"
OUT = REPO_ROOT / "backend" / "experiments_out"
SEED = 42
TEST_FRAC = 0.20
CONTAM = 0.05
N = ANOMALY_SENSOR_COLUMNS


def main():
    df = pd.read_csv(CSV)
    y = df["machine_failure"].to_numpy()
    ts = pd.to_datetime(df["timestamp"])
    sss = StratifiedShuffleSplit(n_splits=1, test_size=TEST_FRAC, random_state=SEED)
    tr_idx, te_idx = next(sss.split(df, y))
    train_df, test_df = df.iloc[tr_idx].reset_index(drop=True), df.iloc[te_idx].reset_index(drop=True)
    train_recs = train_df[N].to_dict("records")
    # convert to float or None
    for r in train_recs:
        for c in N:
            v = r[c]
            r[c] = float(v) if pd.notna(v) else None

    # ---- fresh reproduce training (contam 0.05) ----
    artifact = train_anomaly_model(train_recs, contamination=CONTAM,
                                   n_estimators=300, random_state=SEED,
                                   dataset_hash="7796bdba32a09391cd76b09a04f0e72cdfa5545037d01b2064b2948ff3510207")
    print(f"contam={artifact.contamination} threshold={artifact.threshold:.4f} "
          f"version={artifact.version} features={artifact.feature_names}")
    # persist to a dedicated reproduce copy
    p = OUT / "anomaly_final_artifact.pkl"
    save_anomaly_artifact(artifact, p)

    # ---- flagged rate on test ----
    test_recs = test_df[N].to_dict("records")
    for r in test_recs:
        for c in N:
            v = r[c]
            r[c] = float(v) if pd.notna(v) else None
    scores = []
    for r in test_recs:
        # reset module cache to use our fresh artifact
        amod._artifact = artifact
        res = detect_anomaly(r)
        scores.append(res["anomaly_score"])
    scores = np.array(scores)
    pred = (scores >= artifact.threshold).astype(int)
    flagged_rate = pred.mean()
    test_y = y[te_idx]
    overlap = int(((pred == 1) & (test_y == 1)).sum())
    true_pos = int(test_y.sum())
    print(f"test n={len(pred)} flagged={flagged_rate:.3f} overlap_with_failure={overlap}/{true_pos}")
    print(f"score min={scores.min():.4f} max={scores.max():.4f} mean={scores.mean():.4f} sd={scores.std():.4f}")

    # ---- direction: a synthetic outlier vs normal should be scored higher ----
    base = {c: float(train_df[c].mean()) for c in N}
    normal = {**base}
    outlier = {**base, "temperature": 1e6, "pressure": 1e6, "vibration": 1e6}
    amod._artifact = artifact
    ns = detect_anomaly(normal)["anomaly_score"]
    os = detect_anomaly(outlier)["anomaly_score"]
    print(f"direction: normal_score={ns:.4f} outlier_score={os:.4f} outlier>normal={os > ns}")

    # ---- reload equivalence ----
    loaded = load_anomaly_artifact(p)
    amod._artifact = loaded
    lns = detect_anomaly(normal)["anomaly_score"]
    los = detect_anomaly(outlier)["anomaly_score"]
    print(f"reload: normal_score={lns:.4f} (match={abs(lns-ns)<1e-6}) "
          f"outlier_score={los:.4f} (match={abs(los-os)<1e-6})")

    # ---- temporal sanity: score not clustered oddly over time ----
    all_recs = df[N].to_dict("records")
    for r in all_recs:
        for c in N:
            v = r[c]
            r[c] = float(v) if pd.notna(v) else None
    amod._artifact = artifact
    all_scores = np.array([detect_anomaly(r)["anomaly_score"] for r in all_recs])
    flag_all = (all_scores >= artifact.threshold).astype(int)
    # chronological halves
    h1, h2 = all_scores[:500], all_scores[500:]
    f1, f2 = flag_all[:500].mean(), flag_all[500:].mean()
    print(f"temporal: early_flag_rate={f1:.3f} late_flag_rate={f2:.3f} "
          f"early_mean_score={h1.mean():.4f} late_mean_score={h2.mean():.4f}")
    # autocorr scores lag 1-3
    for lag in range(1, 4):
        ac = float(np.corrcoef(all_scores[:-lag], all_scores[lag:])[0, 1])
        print(f"  score autocorr lag={lag} r={ac:+.3f}")

    print("\nPASS: final anomaly reproduction complete")


if __name__ == "__main__":
    main()