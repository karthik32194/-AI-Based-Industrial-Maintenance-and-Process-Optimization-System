"""
Unit tests for ML pipeline — Section 16
Tests: preprocessing, feature engineering, anomaly detection, failure prediction.
"""
import numpy as np
import pytest

from app.ml.preprocessing import preprocess_sensor_data, preprocess_single, validate_reading
from app.ml.features import engineer_features, get_feature_names
from app.ml.prediction import predict_failure, _classify_risk, _classify_health
from app.ml.anomaly import detect_anomaly
from app.models.prediction import RiskLevel, MachineHealthStatus


# ---------------------------------------------------------------------------
# Preprocessing tests
# ---------------------------------------------------------------------------

def test_validate_reading_valid():
    reading = {"temperature": 80.0, "vibration": 3.5, "pressure": 5.0, "rpm": 1500.0, "power_consumption": 45.0}
    result = validate_reading(reading)
    assert result["temperature"] == 80.0


def test_validate_reading_out_of_range():
    reading = {"temperature": 9999.0, "vibration": 3.5}
    result = validate_reading(reading)
    assert result["temperature"] is None  # Nulled out


def test_preprocess_handles_missing():
    records = [
        {"temperature": 80.0, "vibration": None, "pressure": 5.0, "rpm": None, "power_consumption": 45.0}
    ]
    df = preprocess_sensor_data(records)
    assert df["vibration"].notna().all()  # Missing values imputed


def test_preprocess_empty():
    df = preprocess_sensor_data([])
    assert len(df) == 0


def test_preprocess_single():
    reading = {"temperature": 100.0, "vibration": 5.0, "pressure": 8.0, "rpm": 2000.0, "power_consumption": 60.0}
    df = preprocess_single(reading)
    assert len(df) == 1


# ---------------------------------------------------------------------------
# Feature engineering tests
# ---------------------------------------------------------------------------

def test_engineer_features_columns():
    records = [{"temperature": 80.0, "vibration": 3.5, "pressure": 5.0, "rpm": 1500.0, "power_consumption": 45.0}]
    df = preprocess_sensor_data(records)
    feat = engineer_features(df)
    expected_cols = get_feature_names()
    for col in expected_cols:
        assert col in feat.columns, f"Missing feature column: {col}"


def test_feature_count():
    assert len(get_feature_names()) == 15


# ---------------------------------------------------------------------------
# Risk / health classification tests
# ---------------------------------------------------------------------------

def test_classify_risk_low():
    assert _classify_risk(0.1) == RiskLevel.LOW

def test_classify_risk_medium():
    assert _classify_risk(0.3) == RiskLevel.MEDIUM

def test_classify_risk_high():
    assert _classify_risk(0.6) == RiskLevel.HIGH

def test_classify_risk_critical():
    assert _classify_risk(0.9) == RiskLevel.CRITICAL

def test_classify_health_healthy():
    assert _classify_health(90) == MachineHealthStatus.HEALTHY

def test_classify_health_critical():
    assert _classify_health(20) == MachineHealthStatus.CRITICAL


# ---------------------------------------------------------------------------
# Inference tests (rule-based fallback — no trained model required)
# ---------------------------------------------------------------------------

def test_predict_failure_normal_reading():
    reading = {"temperature": 60.0, "vibration": 2.0, "pressure": 3.0, "rpm": 1200.0, "power_consumption": 30.0}
    result = predict_failure(reading)
    assert "failure_probability" in result
    assert 0.0 <= result["failure_probability"] <= 1.0
    assert result["risk_level"] in list(RiskLevel)
    assert result["health_score"] >= 0.0


def test_predict_failure_high_temp():
    reading = {"temperature": 400.0, "vibration": 80.0, "pressure": 3.0, "rpm": 1200.0, "power_consumption": 30.0}
    result = predict_failure(reading)
    # High temp/vibration should produce elevated risk
    assert result["failure_probability"] > 0.0


def test_detect_anomaly_returns_dict():
    reading = {"temperature": 80.0, "vibration": 3.5, "pressure": 5.0, "rpm": 1500.0, "power_consumption": 45.0}
    result = detect_anomaly(reading)
    assert "is_anomaly" in result
    assert "anomaly_score" in result
    assert isinstance(result["is_anomaly"], bool)
