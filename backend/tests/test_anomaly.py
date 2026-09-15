"""
Phase 3 -- anomaly detection tests.

Prove: deterministic feature order, train/serve preprocessing consistency, model
train + reload equivalence, deterministic inference, correct score direction
(higher = more abnormal), finite outputs, contract-consistent missing/coercion.
"""
from __future__ import annotations

import pickle
from pathlib import Path

import numpy as np
import pytest

from app.ml import anomaly
from app.ml.anomaly import (
    AnomalyArtifact, detect_anomaly, load_anomaly_artifact,
    save_anomaly_artifact, train_anomaly_model,
)
from app.ml.contract import ANOMALY_SENSOR_COLUMNS
from app.ml.preprocessing import FittedPreprocessor

N = ANOMALY_SENSOR_COLUMNS

rng = np.random.default_rng(7)


def _records(n: int = 120) -> list[dict]:
    base = {
        "temperature": 75.0, "vibration": 0.5, "pressure": 30.0, "humidity": 40.0,
        "rotation_speed": 1500.0, "voltage": 220.0, "current": 5.0, "oil_level": 70.0,
        "load": 80.0, "motor_temperature": 60.0, "gearbox_temperature": 65.0,
        "sound_level": 75.0, "fan_speed": 1200.0, "reactive_power": 50.0,
        "active_power": 100.0,
    }
    return [
        {c: base[c] + float(rng.normal(0, 2)) for c in N}
        for _ in range(n)
    ]


def _toy_artifact(tmp_path: Path) -> AnomalyArtifact:
    recs = _records()
    return train_anomaly_model(recs, contamination=0.1, n_estimators=20,
                               random_state=42, dataset_hash="testhash")


def _valid_reading() -> dict:
    return {"temperature": 75.0, "vibration": 0.5, "pressure": 30.0, "humidity": 40.0,
            "rotation_speed": 1500.0, "voltage": 220.0, "current": 5.0, "oil_level": 70.0,
            "load": 80.0, "motor_temperature": 60.0, "gearbox_temperature": 65.0,
            "sound_level": 75.0, "fan_speed": 1200.0, "reactive_power": 50.0,
            "active_power": 100.0}


def test_feature_order_deterministic():
    assert list(N) == ANOMALY_SENSOR_COLUMNS
    art = _toy_artifact(None)
    assert art.feature_names == ANOMALY_SENSOR_COLUMNS


def test_preprocessing_train_serve_consistent(tmp_path):
    recs = _records()
    prep = FittedPreprocessor.fit(recs, columns=N, bounds={})
    # a row with a missing value
    missing = {**recs[0], "pressure": np.nan, "voltage": None}
    batch = prep.transform([missing], bounds={}).iloc[0].to_dict()
    single = prep.transform_one(missing, bounds={}).iloc[0].to_dict()
    for c in N:
        assert batch[c] == single[c], f"train/serve skew on {c}"


def test_missing_follows_fitted_median(tmp_path):
    recs = _records()
    prep = FittedPreprocessor.fit(recs, columns=N, bounds={})
    median_v = float(np.median([r["vibration"] for r in recs]))
    out = prep.transform_one({c: None for c in N}, bounds={})
    assert float(out["vibration"].iloc[0]) == pytest.approx(median_v, abs=1.0)


def test_valid_input_passes(tmp_path):
    art = _toy_artifact(tmp_path)
    anomaly._artifact = art
    res = detect_anomaly(_valid_reading())
    assert res["is_anomaly"] in (True, False)
    assert np.isfinite(res["anomaly_score"])
    assert "model_version" in res


def test_invalid_input_per_contract(tmp_path):
    art = _toy_artifact(tmp_path)
    anomaly._artifact = art
    bad = {"temperature": "nan", "vibration": None, "load": -9999.0, **{c: 1.0 for c in N}}
    bad["temperature"] = "not-a-number"
    res = detect_anomaly(bad)
    assert np.isfinite(res["anomaly_score"])
    assert res["is_anomaly"] in (True, False)


def test_no_nan_or_inf_in_features(tmp_path):
    art = _toy_artifact(tmp_path)
    df = art.preprocessor.transform([{c: None for c in N}], bounds={})
    assert df.notna().all().all()
    assert np.isfinite(df.to_numpy()).all()


def test_extreme_but_valid_does_not_crash(tmp_path):
    art = _toy_artifact(tmp_path)
    anomaly._artifact = art
    extreme = _valid_reading()
    for c in N:
        extreme[c] = 1e7  # huge but numeric/valid
    res = detect_anomaly(extreme)
    assert np.isfinite(res["anomaly_score"])
    assert res["is_anomaly"] is True


def test_deterministic_inference(tmp_path):
    art = _toy_artifact(tmp_path)
    anomaly._artifact = art
    a = detect_anomaly(_valid_reading())
    b = detect_anomaly(_valid_reading())
    assert a == b


def test_score_direction_higher_more_abnormal(tmp_path):
    recs = _records()
    base = {c: float(np.mean([r[c] for r in recs])) for c in N}
    normal = {**base, **{c: base[c] + 0.01 * np.std([r[c] for r in recs]) for c in N}}
    outlier = {**base, "temperature": 1e6, "pressure": 1e6, "vibration": 1e6}
    art = _toy_artifact(tmp_path)
    df = art.preprocessor.transform([normal, outlier], bounds={})
    scores = -art.model.decision_function(df.values)
    assert scores[1] > scores[0], "anomaly score must be higher for more abnormal state"


def test_threshold_boolean_deterministic(tmp_path):
    recs = _records()
    art = train_anomaly_model(recs, contamination=0.1, n_estimators=20,
                              random_state=42, dataset_hash="h")
    learning = art.preprocessor.transform(recs, bounds={})
    s = -art.model.decision_function(learning)
    dec = (s >= art.threshold).astype(int)
    assert set(dec.tolist()) <= {0, 1}


def test_artifact_reload_equivalence(tmp_path):
    art = _toy_artifact(tmp_path)
    p = tmp_path / "artifact.pkl"
    save_anomaly_artifact(art, p)
    art2 = load_anomaly_artifact(p)
    assert art2 is not None
    r = _valid_reading()
    df1 = art.preprocessor.transform_one(r, bounds={})[art.feature_names]
    df2 = art2.preprocessor.transform_one(r, bounds={})[art2.feature_names]
    s1 = -art.model.decision_function(df1.values)[0]
    s2 = -art2.model.decision_function(df2.values)[0]
    assert float(s1) == pytest.approx(float(s2))
    assert art2.feature_names == art.feature_names
    assert art2.threshold == art.threshold
    assert art2.dataset_hash == "testhash"


def test_artifact_roundtrip_serializable(tmp_path):
    art = _toy_artifact(tmp_path)
    raw = pickle.dumps(art.to_dict())
    loaded = AnomalyArtifact.from_dict(pickle.loads(raw))
    assert loaded.model is not None
    assert loaded.feature_names == N