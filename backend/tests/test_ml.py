"""
Unit tests for ML pipeline.
Tests: preprocessing, feature engineering, anomaly detection.
Failure-risk prediction tests live in test_failure_risk.py (Phase 4).
"""
from app.ml.preprocessing import preprocess_sensor_data, preprocess_single, validate_reading
from app.ml.features import engineer_features, get_feature_names
from app.ml.anomaly import detect_anomaly


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
# Feature engineering tests (legacy spec surface; not used by Phase 4 model)
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
# Anomaly detection returns dict
# ---------------------------------------------------------------------------

def test_detect_anomaly_returns_dict():
    reading = {"temperature": 80.0, "vibration": 3.5, "pressure": 5.0, "rpm": 1500.0, "power_consumption": 45.0}
    result = detect_anomaly(reading)
    assert "is_anomaly" in result
    assert "anomaly_score" in result
    assert isinstance(result["is_anomaly"], bool)