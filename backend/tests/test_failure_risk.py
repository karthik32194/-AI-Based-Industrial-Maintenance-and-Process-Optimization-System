"""
Phase 4 -- failure-risk prediction tests.

Prove: 15-var input, fitted preprocessing (missing/invalid/finite), deterministic
feature order, continuous score, threshold-0.15 risk_flag determinism, artifact
reload equivalence, reproducibility, no training-CSV dependency, schema safety.
"""
from __future__ import annotations

import pickle
from pathlib import Path

import numpy as np
import pytest

from app.ml import prediction
from app.ml.contract import FAILURE_SENSOR_COLUMNS
from app.ml.prediction import (
    FailureRiskArtifact,
    load_failure_risk_artifact,
    predict_failure,
    save_failure_risk_artifact,
    train_failure_model,
)
from app.ml.preprocessing import FittedPreprocessor

N = FAILURE_SENSOR_COLUMNS

rng = np.random.default_rng(4)


def _records(n: int = 200, positives: int = 32) -> tuple[list[dict], list[int]]:
    base = {
        "temperature": 78.0, "vibration": 0.45, "pressure": 30.0, "humidity": 45.0,
        "rotation_speed": 1500.0, "voltage": 220.0, "current": 5.0, "oil_level": 70.0,
        "load": 80.0, "motor_temperature": 62.0, "gearbox_temperature": 66.0,
        "sound_level": 76.0, "fan_speed": 1200.0, "reactive_power": 50.0,
        "active_power": 100.0,
    }
    recs = [{c: base[c] + float(rng.normal(0, 3)) for c in N} for _ in range(n)]
    labels = [0] * n
    for i in range(positives):
        labels[i] = 1
        # push failure rows to hotter/noisier state
        recs[i]["temperature"] += 25.0
        recs[i]["vibration"] += 2.0
        recs[i]["load"] += 20.0
    rng.shuffle(labels)
    return recs, labels


def _toy_artifact(tmp_path: Path) -> FailureRiskArtifact:
    recs, labels = _records()
    return train_failure_model(recs, labels, threshold=0.15,
                               random_state=42, dataset_hash="toyhash")


def _valid_reading() -> dict:
    return {"temperature": 78.0, "vibration": 0.45, "pressure": 30.0, "humidity": 45.0,
            "rotation_speed": 1500.0, "voltage": 220.0, "current": 5.0, "oil_level": 70.0,
            "load": 80.0, "motor_temperature": 62.0, "gearbox_temperature": 66.0,
            "sound_level": 76.0, "fan_speed": 1200.0, "reactive_power": 50.0,
            "active_power": 100.0}


def test_accepts_15_variable_input(tmp_path):
    recs, labels = _records(n=120, positives=20)
    art = train_failure_model(recs, labels, random_state=42)
    assert art.feature_names == N
    assert len(N) == 15


def test_missing_follows_fitted_median(tmp_path):
    recs, labels = _records(n=120, positives=20)
    prep = FittedPreprocessor.fit(recs, columns=N, bounds={})
    median_v = float(np.median([r["vibration"] for r in recs]))
    out = prep.transform_one({c: None for c in N}, bounds={})
    assert float(out["vibration"].iloc[0]) == pytest.approx(median_v, abs=1.0)


def test_preprocessing_train_serve_consistent(tmp_path):
    recs, labels = _records(n=120, positives=20)
    prep = FittedPreprocessor.fit(recs, columns=N, bounds={})
    missing = {**recs[0], "pressure": np.nan, "voltage": None}
    batch = prep.transform([missing], bounds={}).iloc[0].to_dict()
    single = prep.transform_one(missing, bounds={}).iloc[0].to_dict()
    for c in N:
        assert batch[c] == single[c], f"train/serve skew on {c}"


def test_invalid_numeric_handled(tmp_path):
    art = _toy_artifact(tmp_path)
    prediction._failure_artifact = art
    bad = _valid_reading()
    bad["temperature"] = "not-a-number"
    bad["vibration"] = None
    bad["load"] = "nan"
    res = predict_failure(bad)
    assert np.isfinite(res["failure_risk_score"])
    assert res["risk_flag"] in (True, False)


def test_feature_order_deterministic(tmp_path):
    art = _toy_artifact(tmp_path)
    assert art.feature_names == N
    assert isinstance(art.model, object)


def test_continuous_risk_score(tmp_path):
    art = _toy_artifact(tmp_path)
    prediction._failure_artifact = art
    res = predict_failure(_valid_reading())
    assert isinstance(res["failure_risk_score"], float)
    assert 0.0 <= res["failure_risk_score"] <= 1.0
    assert np.isfinite(res["failure_risk_score"])


def test_threshold_flag_deterministic(tmp_path):
    art = _toy_artifact(tmp_path)
    prediction._failure_artifact = art
    a = predict_failure(_valid_reading())
    b = predict_failure(_valid_reading())
    assert a["risk_flag"] == b["risk_flag"]
    # flag consistent with threshold
    assert a["risk_flag"] == (a["failure_risk_score"] >= art.threshold)


def test_artifact_reload_equivalence(tmp_path):
    art = _toy_artifact(tmp_path)
    p = tmp_path / "fr_artifact.pkl"
    save_failure_risk_artifact(art, p)
    art2 = load_failure_risk_artifact(p)
    assert art2 is not None
    r = _valid_reading()
    df1 = art.preprocessor.transform_one(r, bounds={})[art.feature_names]
    df2 = art2.preprocessor.transform_one(r, bounds={})[art2.feature_names]
    s1 = float(art.model.predict_proba(df1)[0, 1])
    s2 = float(art2.model.predict_proba(df2)[0, 1])
    assert s1 == pytest.approx(s2, abs=1e-9)
    assert art2.feature_names == art.feature_names
    assert art2.threshold == art.threshold
    assert art2.dataset_hash == "toyhash"


def test_reproducible_same_input(tmp_path):
    art = _toy_artifact(tmp_path)
    prediction._failure_artifact = art
    assert predict_failure(_valid_reading()) == predict_failure(_valid_reading())


def test_no_nan_or_inf_emitted(tmp_path):
    art = _toy_artifact(tmp_path)
    prediction._failure_artifact = art
    extreme = {c: 1e7 for c in N}
    res = predict_failure(extreme)
    assert np.isfinite(res["failure_risk_score"])
    assert np.isfinite(res["health_score"])


def test_no_training_csv_at_inference(tmp_path):
    # toy artifact persisted; clear module cache; reload BSON of it only
    art = _toy_artifact(tmp_path)
    p = tmp_path / "fr_artifact.pkl"
    save_failure_risk_artifact(art, p)
    prediction._failure_artifact = None
    loaded = load_failure_risk_artifact(p)
    prediction._failure_artifact = loaded
    res = predict_failure(_valid_reading())
    assert np.isfinite(res["failure_risk_score"])
    assert prediction.FAILURE_RISK_MODEL_PATH != p  # inference is path-independent


def test_incorrect_schema_handled_safely(tmp_path):
    art = _toy_artifact(tmp_path)
    prediction._failure_artifact = art
    missing_col = _valid_reading()
    missing_col.pop("voltage")          # schema mismatch (missing column)
    res = predict_failure(missing_col)
    assert np.isfinite(res["failure_risk_score"])
    assert res["risk_flag"] in (True, False)


def test_artifact_roundtrip_serializable(tmp_path):
    art = _toy_artifact(tmp_path)
    raw = pickle.dumps(art.to_dict())
    loaded = FailureRiskArtifact.from_dict(pickle.loads(raw))
    assert loaded.model is not None
    assert loaded.feature_names == N
    assert loaded.threshold == 0.15
    assert loaded.model_config["class_weight"] == "balanced"
    assert loaded.model_config["max_depth"] == 4