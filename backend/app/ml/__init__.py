"""ML package — preprocessing, feature engineering, anomaly detection, failure prediction."""
from app.ml.preprocessing import preprocess_sensor_data, preprocess_single, validate_reading
from app.ml.features import engineer_features, get_feature_names
from app.ml.anomaly import detect_anomaly, train_anomaly_model
from app.ml.prediction import predict_failure, calculate_machine_health, train_failure_model
from app.ml.evaluation import evaluate_model

__all__ = [
    "preprocess_sensor_data", "preprocess_single", "validate_reading",
    "engineer_features", "get_feature_names",
    "detect_anomaly", "train_anomaly_model",
    "predict_failure", "calculate_machine_health", "train_failure_model",
    "evaluate_model",
]
