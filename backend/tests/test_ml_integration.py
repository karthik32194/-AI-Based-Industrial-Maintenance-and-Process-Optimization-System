"""
Phase 5 -- backend integration tests.

Prove the full REAL INPUT -> canonical pipeline -> both models -> DB persistence
-> API output flow, plus the explicit ML_UNAVAILABLE behaviour (PHASE 5 Step 5
HARD): a missing artifact must NOT silently fall back to healthy / low-risk.

Three layers are exercised:
  * the ML integration boundary (app.ml.service): canonical->dataset mapping,
    availability, both-model inference;
  * the prediction service: VALID and UNAVAILABLE persistence;
  * the API: sensor ingest (15 channels) -> predict -> response.
"""
from __future__ import annotations

import uuid

import numpy as np
import pytest

from app.ml import anomaly as am
from app.ml import prediction as pm
from app.ml import service as mlservice
from app.ml.anomaly import train_anomaly_model
from app.ml.contract import FAILURE_SENSOR_COLUMNS
from app.ml.prediction import train_failure_model
from app.models.prediction import ML_STATUS_UNAVAILABLE, ML_STATUS_VALID


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

FULL_READING = {
    "temperature": 85.0, "vibration": 4.2, "pressure": 7.0, "rpm": 1800.0,
    "power_consumption": 55.0, "humidity": 45.0, "voltage": 230.0, "current": 6.0,
    "oil_level": 70.0, "load": 80.0, "motor_temperature": 62.0,
    "gearbox_temperature": 66.0, "sound_level": 76.0, "fan_speed": 1200.0,
    "reactive_power": 50.0,
}


@pytest.fixture
def machine_id(client, auth_headers):
    resp = client.post("/api/machines", json={
        "machine_name": "Integration Pump",
        "machine_type": "Pump",
        "location": "Zone B",
    }, headers=auth_headers)
    return resp.json()["id"]


@pytest.fixture
def no_artifacts(monkeypatch):
    """Force both model getters to report unavailable (no silent healthy)."""
    def _raise():
        raise RuntimeError("no artifact")
    # Patch the references bound inside app.ml.service (what run_inference uses).
    monkeypatch.setattr(mlservice, "get_anomaly_artifact", _raise)
    monkeypatch.setattr(mlservice, "get_failure_risk_artifact", _raise)


@pytest.fixture
def toy_artifacts():
    """Train tiny valid artifacts and inject them into the module caches."""
    rng = np.random.default_rng(7)
    fails = list(FAILURE_SENSOR_COLUMNS)
    base = {c: float(rng.normal(50, 10)) for c in fails}
    recs, labels = [], []
    for i in range(120):
        rec = {c: base[c] + float(rng.normal(0, 2)) for c in fails}
        label = 0
        if i % 8 == 0:
            label = 1
            rec["temperature"] += 20.0
            rec["vibration"] += 4.0
        recs.append(rec)
        labels.append(label)
    aart = train_anomaly_model(recs, dataset_hash=None)
    fart = train_failure_model(recs, labels, threshold=0.15, random_state=42, dataset_hash=None)
    am._artifact = aart
    pm._failure_artifact = fart
    yield
    am._artifact = None
    pm._failure_artifact = None


# ---------------------------------------------------------------------------
# ML integration boundary
# ---------------------------------------------------------------------------

def test_build_pipeline_reading_maps_canonical_to_dataset():
    r = mlservice.build_pipeline_reading(FULL_READING)
    # canonical names resolved to dataset names the ML models expect
    assert r["rotation_speed"] == 1800.0
    assert r["active_power"] == 55.0
    assert r["temperature"] == 85.0
    assert r["humidity"] == 45.0
    assert set(r.keys()) == set(FAILURE_SENSOR_COLUMNS)
    # dataset-named keys also accepted directly
    r2 = mlservice.build_pipeline_reading({"rotation_speed": 999.0, "active_power": 88.0})
    assert r2["rotation_speed"] == 999.0
    assert r2["active_power"] == 88.0


def test_available_true_with_cached_artifacts(toy_artifacts):
    ok, missing = mlservice.available()
    assert ok is True
    assert missing == []


def test_available_false_and_run_inference_raises_unavailable(no_artifacts):
    ok, missing = mlservice.available()
    assert ok is False
    assert "anomaly" in missing and "failure-risk" in missing
    with pytest.raises(mlservice.MLUnavailableError):
        mlservice.run_inference(mlservice.build_pipeline_reading(FULL_READING))


def test_run_inference_returns_both_models(toy_artifacts):
    r15 = mlservice.build_pipeline_reading(FULL_READING)
    res = mlservice.run_inference(r15)
    assert res["ml_status"] == ML_STATUS_VALID
    assert res["anomaly_result"]["is_anomaly"] in (True, False)
    assert np.isfinite(res["anomaly_result"]["anomaly_score"])
    assert 0.0 <= res["failure_result"]["failure_risk_score"] <= 1.0
    assert res["failure_result"]["risk_flag"] in (True, False)
    assert res["failure_result"]["model_version"] == "failure_hgb_v1.0"


# ---------------------------------------------------------------------------
# Prediction service: VALID and UNAVAILABLE persistence
# ---------------------------------------------------------------------------

def _ingest(client, auth_headers, machine_id):
    resp = client.post(
        f"/api/machines/{machine_id}/sensor-readings",
        json=FULL_READING, headers=auth_headers,
    )
    assert resp.status_code == 201
    return resp


def test_run_prediction_unavailable_never_fake_healthy(client, db_session, auth_headers, machine_id, no_artifacts):
    from app.services.prediction_service import run_prediction
    from app.models.prediction import Prediction
    _ingest(client, auth_headers, machine_id)  # real input in DB
    p = run_prediction(machine_id=uuid.UUID(machine_id), db=db_session)
    assert p.ml_status == ML_STATUS_UNAVAILABLE
    assert p.failure_risk_score is None
    assert p.risk_flag is None
    assert p.ml_error is not None
    # persisted to DB — an explicit UNAVAILABLE record, never fake healthy
    stored = db_session.query(Prediction).filter(Prediction.machine_id == uuid.UUID(machine_id)).one()
    assert stored.ml_status == ML_STATUS_UNAVAILABLE
    assert stored.failure_risk_score is None
    assert stored.risk_flag is None


def test_run_prediction_valid_persists_score(client, db_session, auth_headers, machine_id, toy_artifacts):
    from app.services.prediction_service import run_prediction
    _ingest(client, auth_headers, machine_id)
    p = run_prediction(machine_id=uuid.UUID(machine_id), db=db_session)
    assert p.ml_status == ML_STATUS_VALID
    assert p.failure_risk_score is not None and np.isfinite(p.failure_risk_score)
    assert 0.0 <= p.failure_risk_score <= 1.0
    assert p.risk_flag in (True, False)
    assert p.input_rpm == 1800.0
    assert p.input_power_consumption == 55.0
    assert p.input_humidity == 45.0


# ---------------------------------------------------------------------------
# API end-to-end
# ---------------------------------------------------------------------------

def test_api_sensor_ingest_15_channels(client, auth_headers, machine_id):
    resp = client.post(
        f"/api/machines/{machine_id}/sensor-readings",
        json=FULL_READING, headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["is_valid"] is True
    assert data["humidity"] == 45.0
    assert data["load"] == 80.0
    assert data["motor_temperature"] == 62.0
    assert data["reactive_power"] == 50.0


def test_api_predict_valid_flow(client, auth_headers, machine_id, toy_artifacts):
    # real input -> ingest
    ingest = client.post(
        f"/api/machines/{machine_id}/sensor-readings",
        json=FULL_READING, headers=auth_headers,
    )
    assert ingest.status_code == 201
    # -> predict
    resp = client.post(
        f"/api/machines/{machine_id}/predict",
        json=None, headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["ml_status"] == ML_STATUS_VALID
    assert data["failure_risk_score"] is not None
    assert 0.0 <= data["failure_risk_score"] <= 1.0
    assert data["risk_flag"] in (True, False)
    assert data["model_version"] == "failure_hgb_v1.0"
    assert data["input_rpm"] == 1800.0
    assert data["input_power_consumption"] == 55.0
    assert data["input_humidity"] == 45.0
    assert "failure_probability" not in data
    assert "risk_level" not in data


def test_api_predict_unavailable_with_override(client, auth_headers, machine_id, no_artifacts):
    # override-reading predict with no artifacts -> UNAVAILABLE, not 200-with-0
    resp = client.post(
        f"/api/machines/{machine_id}/predict",
        json=FULL_READING, headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["ml_status"] == ML_STATUS_UNAVAILABLE
    assert data["failure_risk_score"] is None
    assert data["risk_flag"] is None
    assert data["ml_error"] is not None


def test_api_prediction_history(client, auth_headers, machine_id, toy_artifacts):
    client.post(
        f"/api/machines/{machine_id}/sensor-readings",
        json=FULL_READING, headers=auth_headers,
    )
    client.post(f"/api/machines/{machine_id}/predict", json=None, headers=auth_headers)
    resp = client.get(f"/api/machines/{machine_id}/predictions", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1