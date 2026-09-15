"""
PHASE 6 -- real-artifact end-to-end proof (Steps 9 & 10).

Proves with the ACTUAL shipped model artifacts (not toy):
  1. sensor ingest -> build_pipeline_reading -> run_inference(real artifact)
     -> Prediction row persisted -> fields honest (ml_status VALID, finite
     failure_risk_score, model_version failure_hgb_v1.0, 15-channel snapshot).
  2. ML-unavailable safety: artifact getters forced unavailable -> Prediction
     persists ML_UNAVAILABLE with null score / null flag / ml_error, never a
     fabricated healthy/low-risk result.

Runs against SQLite (test) engine; no production data touched.
Run:  python scripts/phase6_e2e.py
"""
from __future__ import annotations

import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.ml import anomaly as am
from app.ml import prediction as pm
from app.ml import service as mlservice
from app.models.base import Base
from app.models.machine import Machine

ENGINE = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
Session = sessionmaker(bind=ENGINE)

# Stored / canonical representation (canonical names for the 5, dataset names
# for the 10 raw channels -- matches how the backend persists SensorReading).
READING_15 = {
    "temperature": 85.0, "vibration": 4.2, "pressure": 7.0, "rpm": 1800.0,
    "power_consumption": 55.0, "humidity": 45.0, "voltage": 230.0, "current": 6.0,
    "oil_level": 70.0, "load": 80.0, "motor_temperature": 62.0,
    "gearbox_temperature": 66.0, "sound_level": 76.0, "fan_speed": 1200.0,
    "reactive_power": 50.0,
}

report: dict = {}


def main() -> int:
    Base.metadata.create_all(ENGINE)
    db = Session()

    mach = Machine(machine_name="PH6 Pump", machine_type="Pump", location="Zone A")
    db.add(mach); db.commit(); db.refresh(mach)
    mid = mach.id

    # ---- Real artifacts present ----
    ok, missing = mlservice.available()
    real_artifacts_present = ok and missing == []
    report["real_artifacts_available"] = bool(real_artifacts_present)
    report["failure_artifact_version"] = pm.get_failure_risk_artifact().version
    report["failure_artifact_hash_set"] = bool(pm.get_failure_risk_artifact().dataset_hash)
    report["anomaly_artifact_contamination"] = am.get_anomaly_artifact().contamination

    # real pipeline reading -> real artifact inference
    r15 = mlservice.build_pipeline_reading(
        {"rpm": 1800.0, "power_consumption": 55.0, **{k: v for k, v in READING_15.items()}}
    )
    assert set(r15.keys()) == set(pm.get_failure_risk_artifact().feature_names)
    report["canonical_15_columns"] = sorted(r15.keys())

    res = mlservice.run_inference(r15)
    f = res["failure_result"]; an = res["anomaly_result"]
    report["valid_ml_status"] = res["ml_status"]
    report["failure_risk_score_finite_01"] = bool(0.0 <= f["failure_risk_score"] <= 1.0)
    report["risk_flag_bool"] = isinstance(f["risk_flag"], bool)
    report["model_version"] = f["model_version"]
    report["anomaly_score_finite"] = isinstance(an["anomaly_score"], (int, float))
    report["anomaly_flag_bool"] = isinstance(an["is_anomaly"], bool)

    # ---- Persist a Prediction via the real service ----
    from app.models.sensor_reading import SensorReading
    db.add(SensorReading(machine_id=mid, **{k: v for k, v in READING_15.items()}))
    db.commit()

    from app.models.prediction import ML_STATUS_UNAVAILABLE, ML_STATUS_VALID, Prediction
    from app.services.prediction_service import run_prediction

    p = run_prediction(machine_id=mid, db=db)
    report["prediction_ml_status"] = p.ml_status
    report["prediction_risk_score_finite"] = bool(p.failure_risk_score is not None and p.failure_risk_score <= 1.0)
    report["prediction_risk_flag_bool"] = isinstance(p.risk_flag, bool)
    report["prediction_health_score"] = p.health_score
    report["prediction_model_version"] = p.model_version
    report["prediction_snapshot_rpm"] = p.input_rpm
    report["prediction_snapshot_power"] = p.input_power_consumption
    report["prediction_snapshot_humidity"] = p.input_humidity
    report["ml_status_valid_persisted"] = p.ml_status == ML_STATUS_VALID

    # ---- ML-unavailable safety (Step 10 HARD) ----
    def _raise(): raise RuntimeError("no artifact")
    am._artifact = None; pm._failure_artifact = None
    import app.ml.service as svc
    # patch the loader references the boundary uses
    am._orig_getter = None
    # force by making both module caches None -> getters raise on load attempt
    # Point getters at a function that raises:
    svc.get_anomaly_artifact = _raise
    svc.get_failure_risk_artifact = _raise
    p2 = run_prediction(machine_id=mid, db=db)
    report["unavailable_ml_status"] = p2.ml_status
    report["unavailable_score_null"] = p2.failure_risk_score is None
    report["unavailable_flag_null"] = p2.risk_flag is None
    report["unavailable_error_truthy"] = bool(p2.ml_error)
    report["ml_unavailable_never_fake_healthy"] = (
        p2.ml_status == ML_STATUS_UNAVAILABLE
        and p2.failure_risk_score is None
        and p2.risk_flag is None
    )

    # restore real getters for any later phase
    from app.ml.anomaly import get_anomaly_artifact as ga
    from app.ml.prediction import get_failure_risk_artifact as gf
    svc.get_anomaly_artifact = ga
    svc.get_failure_risk_artifact = gf

    db.close()
    print(__import__("json").dumps(report, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())