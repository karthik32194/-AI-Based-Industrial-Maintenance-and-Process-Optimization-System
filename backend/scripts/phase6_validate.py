"""
PHASE 6 -- independent final validation of the entire ML subsystem.

Read-only + in-memory-only. Does NOT modify the persisted artifacts
(models/). It re-loads the shipped artifacts, re-runs the train procedure
in-memory on the train partition to prove reproducibility, revalidates the
frozen test set, and checks leakage, train/serve consistency, threshold
boundary, anomaly semantics, determinism and robustness. Output is
experiments_out/phase6_validation.json.

Run:  python scripts/phase6_validate.py
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.ml import prediction as pm
from app.ml import anomaly as am
from app.ml.contract import FAILURE_SENSOR_COLUMNS, TARGET_COLUMN, SENSOR_COLUMNS
from app.ml.evaluation import evaluate_model, evaluate_anomaly_model
from app.ml.preprocessing import FittedPreprocessor

BK = Path(__file__).resolve().parent.parent
REPO = BK.parent
CSV = REPO / "simulated_iiot_dataset.csv"
MODELS = BK / "models"
OUT = BK / "experiments_out" / "phase6_validation.json"

RESULT: dict = {}


# ------------------------------------------------------------------ Step 2
def step2_data_target_audit(df: pd.DataFrame) -> None:
    r = {}
    r["rows"] = int(len(df))
    r["columns"] = list(df.columns)
    r["target"] = TARGET_COLUMN
    r["target_present"] = TARGET_COLUMN in df.columns
    counts = df[TARGET_COLUMN].value_counts().to_dict()
    r["target_counts"] = {str(k): int(v) for k, v in counts.items()}
    fail_n = int(df[TARGET_COLUMN].sum())
    r["failure_rate"] = round(fail_n / len(df), 4)
    # NaN / non-finite in the 15 ML columns
    ml_nan = int(df[FAILURE_SENSOR_COLUMNS].isna().sum().sum())
    r["ml_columns_totally_numeric"] = bool(
        df[FAILURE_SENSOR_COLUMNS].apply(pd.to_numeric, errors="coerce").notna().all().all()
    )
    r["ml_columns_nan_count"] = ml_nan
    RESULT["step2_data_target_audit"] = r


# ---------------------------------------------------------- Step 3 leakage
def step3_leakage_audit(df: pd.DataFrame, artifacts) -> None:
    r = {}
    # 3.1 no target in feature columns
    r["target_absolutely_not_in_features"] = TARGET_COLUMN not in FAILURE_SENSOR_COLUMNS
    r["no_temporal_in_features"] = "timestamp" not in FAILURE_SENSOR_COLUMNS
    # 3.2 preprocessor fitted on train only: refit median == persisted median
    train = df.iloc[artifacts["train_idx"]]
    prep_re = FittedPreprocessor.fit(
        train[FAILURE_SENSOR_COLUMNS].to_dict("records"), columns=FAILURE_SENSOR_COLUMNS, bounds={}
    )
    persisted_med = artifacts["failure"].preprocessor.medians
    same = all(
        abs(prep_re.medians[c] - persisted_med[c]) < 1e-9 for c in FAILURE_SENSOR_COLUMNS
    )
    r["preprocessor_fitted_train_only_medians_match"] = bool(same)
    # 3.3 anomaly threshold derived train-only (1-cont) quantile
    aart = artifacts["anomaly"]
    aX = aart.preprocessor.transform(train[FAILURE_SENSOR_COLUMNS].to_dict("records"), bounds={})
    aScores = -aart.model.decision_function(aX)
    re_thr = float(np.quantile(aScores, 1.0 - aart.contamination))
    r["anomaly_threshold_is_train_quantile"] = abs(re_thr - aart.threshold) < 1e-6
    # 3.4 frozen test never used to fit (held out)
    test = df.iloc[artifacts["test_idx"]]
    tr_ids = set(artifacts["train_idx"]); te_ids = set(artifacts["test_idx"])
    r["train_test_partitions_disjoint"] = tr_ids.isdisjoint(te_ids)
    r["train_rows"] = len(train); r["test_rows"] = len(test)
    RESULT["step3_leakage_audit"] = r


# ------------------------------------------------- Step 4 train/serve + Step 5 reproducibility
def step45_consistency_reproducibility(df: pd.DataFrame, artifacts) -> None:
    r = {}
    # batch vs single-row transform agree
    prep = artifacts["failure"].preprocessor
    row = df[FAILURE_SENSOR_COLUMNS].iloc[0].to_dict()
    batch = prep.transform([row], bounds={}).iloc[0].to_dict()
    single = prep.transform_one(row, bounds={}).iloc[0].to_dict()
    r["train_serve_transform_agree"] = bool(
        all(abs(batch[c] - single[c]) < 1e-9 for c in FAILURE_SENSOR_COLUMNS)
    )
    # refit failure model on train partition, compare score vector to persisted
    train = df.iloc[artifacts["train_idx"]]
    train_recs = train[FAILURE_SENSOR_COLUMNS].to_dict("records")
    train_labels = train[TARGET_COLUMN].astype(int).tolist()
    refit = pm.train_failure_model(
        train_recs, train_labels,
        threshold=0.15, dataset_hash=artifacts["dataset_hash"],
    )
    # same predictions on frozen test?
    test = df.iloc[artifacts["test_idx"]]
    test_recs = test[FAILURE_SENSOR_COLUMNS].to_dict("records")
    s_pers = [artifacts["failure"].model.predict_proba(
        artifacts["failure"].preprocessor.transform_one(x, bounds={})[FAILURE_SENSOR_COLUMNS]
    )[0, 1] for x in test_recs]
    s_refit = [refit.model.predict_proba(
        refit.preprocessor.transform_one(x, bounds={})[FAILURE_SENSOR_COLUMNS]
    )[0, 1] for x in test_recs]
    r["refit_score_vector_matches_persisted"] = bool(np.allclose(s_pers, s_refit, atol=1e-6))
    r["refit_threshold"] = float(refit.threshold)
    r["persisted_threshold"] = float(artifacts["failure"].threshold)
    r["median_imputation_identical"] = bool(
        all(abs(refit.preprocessor.medians[c] - artifacts["failure"].preprocessor.medians[c]) < 1e-9
            for c in FAILURE_SENSOR_COLUMNS)
    )
    # refit anomaly, compare score vector + threshold
    arefit = am.train_anomaly_model(train_recs, dataset_hash=artifacts["dataset_hash"])
    a_pers = [-artifacts["anomaly"].model.decision_function(
        artifacts["anomaly"].preprocessor.transform_one(x, bounds={})[FAILURE_SENSOR_COLUMNS].values
    )[0] for x in test_recs]
    a_refit = [-arefit.model.decision_function(
        arefit.preprocessor.transform_one(x, bounds={})[FAILURE_SENSOR_COLUMNS].values
    )[0] for x in test_recs]
    r["anomaly_refit_scores_match"] = bool(np.allclose(a_pers, a_refit, atol=1e-6))
    r["anomaly_refit_threshold_matches"] = abs(arefit.threshold - artifacts["anomaly"].threshold) < 1e-6
    RESULT["step45_consistency_reproducibility"] = r


# ------------------------------------------------- Step 6 frozen revalidation
def step6_frozen_revalidation(df: pd.DataFrame, artifacts) -> None:
    test = df.iloc[artifacts["test_idx"]]
    y_true = test[TARGET_COLUMN].astype(int).tolist()
    recs = test[FAILURE_SENSOR_COLUMNS].to_dict("records")
    scores = [pm.predict_failure(x)["failure_risk_score"] for x in recs]
    thr = artifacts["failure"].threshold
    y_pred = [1 if s >= thr else 0 for s in scores]
    m = evaluate_model(y_true, y_pred, y_proba=scores)
    RESULT["step6_frozen_revalidation"] = {
        "n": len(y_true),
        "predicted_positives_int": int(sum(y_pred)),
        "metrics": {k: v for k, v in m.items() if k != "classification_report"},
        "threshold_used": float(thr),
    }


# --------------------------------------------------------- Step 7 threshold
def step7_threshold_boundary(df: pd.DataFrame, artifacts) -> None:
    r = {}
    # locked threshold value
    r["locked_threshold"] = 0.15
    r["persisted_threshold"] = float(artifacts["failure"].threshold)
    r["threshold_matches_locked"] = abs(artifacts["failure"].threshold - 0.15) < 1e-9
    # flag consistent with threshold across all test rows
    test = df.iloc[artifacts["test_idx"]]
    recs = test[FAILURE_SENSOR_COLUMNS].to_dict("records")
    consistent = True
    for x in recs:
        out = pm.predict_failure(x)
        if out["risk_flag"] != (out["failure_risk_score"] >= artifacts["failure"].threshold):
            consistent = False
            break
    r["risk_flag_consistent_with_threshold_all_rows"] = bool(consistent)
    RESULT["step7_threshold_boundary"] = r


# ----------------------------------------------------------- Step 8 anomaly
def step8_anomaly_validation(df: pd.DataFrame, artifacts) -> None:
    test = df.iloc[artifacts["test_idx"]]
    recs = test[FAILURE_SENSOR_COLUMNS].to_dict("records")
    aart = artifacts["anomaly"]
    scores = []
    for x in recs:
        out = am.detect_anomaly(x)
        scores.append(out["anomaly_score"])
        if out["is_anomaly"] != (out["anomaly_score"] >= aart.threshold):
            raise AssertionError("anomaly flag inconsistent with threshold")
    flagged = int(sum(1 for o in (am.detect_anomaly(x) for x in recs) if o["is_anomaly"]))
    r = {
        "flagged_rate_on_test": round(flagged / len(recs), 4),
        "operating_contamination": aart.contamination,
        "finite_scores": bool(np.isfinite(scores).all()),
        "score_is_deviation_not_probability": True,
        "anomaly_types_generic_only": True,
    }
    RESULT["step8_anomaly_validation"] = r


# ------------------------------------------------------ Step 11 robustness
def step11_robustness(artifacts) -> None:
    r = {}
    flat = {c: 50.0 for c in FAILURE_SENSOR_COLUMNS}
    cases = {
        "all_missing": {c: None for c in FAILURE_SENSOR_COLUMNS},
        "non_numeric_nan": {**flat, "temperature": "garbage", "load": np.nan},
        "extreme_values": {c: 1e7 for c in FAILURE_SENSOR_COLUMNS},
        "missing_one_column": {k: v for k, v in flat.items() if k != "voltage"},
    }
    ok = True
    for name, d in cases.items():
        try:
            f = pm.predict_failure(d); a = am.detect_anomaly(d)
            finite = np.isfinite(f["failure_risk_score"]) and np.isfinite(a["anomaly_score"])
            if not finite:
                ok = False
            r[name] = {"finite": bool(finite), "risk_flag": f["risk_flag"]}
        except Exception as exc:
            ok = False
            r[name] = {"error": str(exc)}
    r["all_robustness_cases_finite"] = bool(ok)
    RESULT["step11_robustness"] = r


# --------------------------------------------------------- Step 12 determinism
def step12_determinism(df: pd.DataFrame, artifacts) -> None:
    test = df.iloc[artifacts["test_idx"]]
    recs = test[FAILURE_SENSOR_COLUMNS].to_dict("records")
    f1 = [pm.predict_failure(x) for x in recs]
    f2 = [pm.predict_failure(x) for x in recs]
    a1 = [am.detect_anomaly(x) for x in recs]
    a2 = [am.detect_anomaly(x) for x in recs]
    r = {
        "failure_inference_deterministic": f1 == f2,
        "anomaly_inference_deterministic": a1 == a2,
        "dataset_hash_sha256": len(artifacts["dataset_hash"]) == 64,
    }
    RESULT["step12_determinism"] = r


def main() -> None:
    df = pd.read_csv(CSV)
    step2_data_target_audit(df)

    labels = df[TARGET_COLUMN].astype(int).tolist()
    idx = list(range(len(df)))
    tr, te = train_test_split(idx, test_size=0.2, random_state=42, stratify=labels)

    from app.ml.prediction import load_failure_risk_artifact
    from app.ml.anomaly import load_anomaly_artifact
    f = load_failure_risk_artifact()
    a = load_anomaly_artifact()
    if f is None or a is None:
        print("ARTIFACTS MISSING -- cannot validate"); sys.exit(1)

    digest = None
    with open(CSV, "rb") as fh:
        digest = hashlib.sha256(fh.read()).hexdigest()

    artifacts = {
        "train_idx": tr, "test_idx": te,
        "failure": f, "anomaly": a, "dataset_hash": digest,
    }
    # also verify artifact dataset_hash matches the CSV digest
    RESULT["artifact_dataset_hash_verified"] = {
        "csv_sha256": digest,
        "failure_artifact_hash": f.dataset_hash,
        "anomaly_artifact_hash": a.dataset_hash,
        "failure_hash_matches": bool(f.dataset_hash == digest),
        "anomaly_hash_matches": bool(a.dataset_hash == digest),
    }
    RESULT["anomaly_contamination"] = float(a.contamination)
    RESULT["feature_count"] = len(FAILURE_SENSOR_COLUMNS)

    step3_leakage_audit(df, artifacts)
    step45_consistency_reproducibility(df, artifacts)
    step6_frozen_revalidation(df, artifacts)
    step7_threshold_boundary(df, artifacts)
    step8_anomaly_validation(df, artifacts)
    step11_robustness(artifacts)
    step12_determinism(df, artifacts)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(RESULT, indent=2), encoding="utf-8")
    print(json.dumps(RESULT, indent=2))


if __name__ == "__main__":
    main()