"""
Model evaluation utilities — Section 16 (evaluate_model)
Computes standard classification metrics for ML model quality assessment.
"""
from __future__ import annotations

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

from app.core.logging import get_logger

logger = get_logger(__name__)


def evaluate_model(
    y_true: list[int],
    y_pred: list[int],
    y_proba: list[float] | None = None,
) -> dict:
    """
    Compute classification metrics for a trained ML model.

    Args:
        y_true:  Ground-truth binary labels (0=normal, 1=failure).
        y_pred:  Predicted binary labels.
        y_proba: Predicted probabilities for class 1 (optional, for AUC-ROC).

    Returns:
        Dict of metric names to values.
    """
    metrics: dict = {
        "accuracy": round(accuracy_score(y_true, y_pred), 4),
        "precision": round(precision_score(y_true, y_pred, zero_division=0), 4),
        "recall": round(recall_score(y_true, y_pred, zero_division=0), 4),
        "f1_score": round(f1_score(y_true, y_pred, zero_division=0), 4),
        "confusion_matrix": confusion_matrix(y_true, y_pred).tolist(),
    }

    if y_proba is not None:
        try:
            metrics["roc_auc"] = round(roc_auc_score(y_true, y_proba), 4)
        except ValueError as exc:
            logger.warning("roc_auc_skipped", reason=str(exc))
            metrics["roc_auc"] = None

    report = classification_report(y_true, y_pred, zero_division=0, output_dict=True)
    metrics["classification_report"] = report

    logger.info(
        "model_evaluation_complete",
        accuracy=metrics["accuracy"],
        precision=metrics["precision"],
        recall=metrics["recall"],
        f1=metrics["f1_score"],
    )
    return metrics


def evaluate_anomaly_model(
    y_true: list[int],
    anomaly_scores: list[float],
    threshold: float = 0.5,
) -> dict:
    """
    Evaluate anomaly detection model using a score threshold.

    Args:
        y_true:         Ground-truth labels (1 = anomaly, 0 = normal).
        anomaly_scores: Raw anomaly scores (higher = more anomalous).
        threshold:      Score threshold above which a reading is flagged as anomaly.
    """
    y_pred = [1 if s >= threshold else 0 for s in anomaly_scores]
    return evaluate_model(y_true, y_pred, y_proba=anomaly_scores)
