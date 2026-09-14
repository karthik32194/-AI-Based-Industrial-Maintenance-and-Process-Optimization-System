# ============================================================
# 1. LOAD DATASET
# ============================================================

import pandas as pd

df = pd.read_csv("simulated_iiot_dataset.csv")

print("First 5 rows:")
print(df.head())


# ============================================================
# 2. DATASET INFORMATION
# ============================================================

print("\nDataset shape:")
print(df.shape)

print("\nColumn names:")
print(df.columns)

print("\nDataset information:")
df.info()

print("\nMissing values:")
print(df.isnull().sum())


# ============================================================
# 3. MACHINE FAILURE ANALYSIS
# ============================================================

print("\nMachine Failure Counts:")
print(df["machine_failure"].value_counts())

print("\nMachine Failure Percentages:")
print(df["machine_failure"].value_counts(normalize=True) * 100)


# ============================================================
# 4. STATISTICAL SUMMARY
# ============================================================

print("\nStatistical Summary:")
print(df.describe())


# ============================================================
# 5. GRAPHICAL ANALYSIS
# ============================================================

import matplotlib.pyplot as plt
import seaborn as sns


# ------------------------------
# Machine Failure Distribution
# ------------------------------

df["machine_failure"].value_counts().plot(kind="bar")

plt.title("Machine Failure Distribution")
plt.xlabel("Machine Failure")
plt.ylabel("Number of Machines")
plt.xticks([0, 1], ["No Failure", "Failure"], rotation=0)

plt.show()


# ------------------------------
# Temperature vs Failure
# ------------------------------

sns.boxplot(
    x="machine_failure",
    y="temperature",
    data=df
)

plt.title("Temperature vs Machine Failure")
plt.xlabel("Machine Failure")
plt.ylabel("Temperature")

plt.xticks([0, 1], ["No Failure", "Failure"])

plt.show()


# ------------------------------
# Vibration vs Failure
# ------------------------------

sns.boxplot(
    x="machine_failure",
    y="vibration",
    data=df
)

plt.title("Vibration vs Machine Failure")
plt.xlabel("Machine Failure")
plt.ylabel("Vibration")

plt.xticks([0, 1], ["No Failure", "Failure"])

plt.show()


# ------------------------------
# Motor Temperature vs Failure
# ------------------------------

sns.boxplot(
    x="machine_failure",
    y="motor_temperature",
    data=df
)

plt.title("Motor Temperature vs Machine Failure")
plt.xlabel("Machine Failure")
plt.ylabel("Motor Temperature")

plt.xticks([0, 1], ["No Failure", "Failure"])

plt.show()


# ============================================================
# 6. CORRELATION ANALYSIS
# ============================================================

plt.figure(figsize=(12, 8))

correlation = df.drop(columns=["timestamp"]).corr()

sns.heatmap(
    correlation,
    annot=True,
    cmap="coolwarm",
    fmt=".2f"
)

plt.title("Correlation Heatmap")

plt.show()


# ============================================================
# 7. DATA PREPARATION FOR MACHINE LEARNING
# ============================================================

# Convert timestamp into datetime format

df["timestamp"] = pd.to_datetime(df["timestamp"])


# Extract useful time features

df["hour"] = df["timestamp"].dt.hour
df["day"] = df["timestamp"].dt.day
df["month"] = df["timestamp"].dt.month
df["day_of_week"] = df["timestamp"].dt.dayofweek


# Remove original timestamp

df = df.drop(columns=["timestamp"])


# Separate features and target

X = df.drop(columns=["machine_failure"])

y = df["machine_failure"]


print("\nX shape:")
print(X.shape)

print("\ny shape:")
print(y.shape)


# ============================================================
# 8. TRAIN TEST SPLIT
# ============================================================

from sklearn.model_selection import train_test_split

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

print("\nTraining data:")
print(X_train.shape)

print("Testing data:")
print(X_test.shape)


# ============================================================
# 9. IMPORT EVALUATION METRICS
# ============================================================

from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix
)


# ============================================================
# 10. LOGISTIC REGRESSION
# ============================================================

from sklearn.linear_model import LogisticRegression

model = LogisticRegression(max_iter=1000)


# Train model

model.fit(X_train, y_train)

print("\nLogistic Regression training completed!")


# Make predictions

y_pred = model.predict(X_test)


# Evaluation

accuracy = accuracy_score(y_test, y_pred)

print("\nLogistic Regression Accuracy:")
print(accuracy)

print("\nClassification Report:")
print(classification_report(y_test, y_pred))

print("\nConfusion Matrix:")
print(confusion_matrix(y_test, y_pred))


# ============================================================
# 11. FEATURE SCALING
# ============================================================

from sklearn.preprocessing import StandardScaler

scaler = StandardScaler()


# Fit scaler using training data
# Then transform training data

X_train_scaled = scaler.fit_transform(X_train)


# Transform test data using the same scaler

X_test_scaled = scaler.transform(X_test)


print("\nFeature scaling completed!")


# ============================================================
# 12. SCALED LOGISTIC REGRESSION
# ============================================================

scaled_model = LogisticRegression(max_iter=1000)


# Train scaled model

scaled_model.fit(X_train_scaled, y_train)

print("\nScaled Logistic Regression training completed!")


# Make predictions

y_pred_scaled = scaled_model.predict(X_test_scaled)


# Evaluation

accuracy_scaled = accuracy_score(
    y_test,
    y_pred_scaled
)

print("\nScaled Logistic Regression Accuracy:")
print(accuracy_scaled)

print("\nClassification Report:")
print(classification_report(
    y_test,
    y_pred_scaled
))

print("\nConfusion Matrix:")
print(confusion_matrix(
    y_test,
    y_pred_scaled
))
# ============================================================
# 13. DECISION TREE
# ============================================================

from sklearn.tree import DecisionTreeClassifier

tree_model = DecisionTreeClassifier(
    class_weight="balanced",
    random_state=42
)

# Train model

tree_model.fit(X_train, y_train)

print("\nImproved Decision Tree training completed!")

# Make predictions

y_pred_tree = tree_model.predict(X_test)

# Evaluation

tree_accuracy = accuracy_score(
    y_test,
    y_pred_tree
)

print("\nImproved Decision Tree Accuracy:")
print(tree_accuracy)

print("\nClassification Report:")
print(classification_report(
    y_test,
    y_pred_tree
))

print("\nConfusion Matrix:")
print(confusion_matrix(
    y_test,
    y_pred_tree
))
# ============================================================
# 14. RANDOM FOREST
# ============================================================

from sklearn.ensemble import RandomForestClassifier

rf_model = RandomForestClassifier(
    n_estimators=100,
    class_weight="balanced",
    random_state=42
)


# Train model

rf_model.fit(X_train, y_train)

print("\nRandom Forest training completed!")


# Make predictions

y_pred_rf = rf_model.predict(X_test)


# Evaluation

rf_accuracy = accuracy_score(
    y_test,
    y_pred_rf
)

print("\nRandom Forest Accuracy:")
print(rf_accuracy)

print("\nClassification Report:")
print(classification_report(
    y_test,
    y_pred_rf
))

print("\nConfusion Matrix:")
print(confusion_matrix(
    y_test,
    y_pred_rf
))


# ============================================================
# IMPROVED XGBOOST
# ============================================================

from xgboost import XGBClassifier

# Calculate class imbalance
negative = y_train.value_counts()[0]
positive = y_train.value_counts()[1]

scale_pos_weight = negative / positive

print("\nScale Pos Weight:", scale_pos_weight)

xgb_model = XGBClassifier(
    n_estimators=100,
    max_depth=4,
    learning_rate=0.1,
    scale_pos_weight=scale_pos_weight,
    random_state=42,
    eval_metric="logloss"
)

# Train model
xgb_model.fit(X_train, y_train)

print("\nImproved XGBoost training completed!")

# Make predictions
y_pred_xgb = xgb_model.predict(X_test)

# ============================================================
# EVALUATION
# ============================================================

xgb_accuracy = accuracy_score(
    y_test,
    y_pred_xgb
)

print("\nImproved XGBoost Accuracy:")
print(xgb_accuracy)

print("\nClassification Report:")
print(classification_report(
    y_test,
    y_pred_xgb
))

print("\nConfusion Matrix:")
print(confusion_matrix(
    y_test,
    y_pred_xgb
))
# ============================================================
# 16. CHECK TRAINING AND TESTING CLASS DISTRIBUTION
# ============================================================

print("\nTraining class distribution:")
print(y_train.value_counts())

print("\nTesting class distribution:")
print(y_test.value_counts())
# ============================================================
# 17. MODEL COMPARISON
# ============================================================

from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

results = {
    "Logistic Regression": [
        accuracy_score(y_test, y_pred),
        precision_score(y_test, y_pred),
        recall_score(y_test, y_pred),
        f1_score(y_test, y_pred)
    ],

    "Scaled Logistic Regression": [
        accuracy_score(y_test, y_pred_scaled),
        precision_score(y_test, y_pred_scaled),
        recall_score(y_test, y_pred_scaled),
        f1_score(y_test, y_pred_scaled)
    ],

    "Decision Tree": [
        accuracy_score(y_test, y_pred_tree),
        precision_score(y_test, y_pred_tree),
        recall_score(y_test, y_pred_tree),
        f1_score(y_test, y_pred_tree)
    ],

    "Random Forest": [
        accuracy_score(y_test, y_pred_rf),
        precision_score(y_test, y_pred_rf),
        recall_score(y_test, y_pred_rf),
        f1_score(y_test, y_pred_rf)
    ],

    "XGBoost": [
        accuracy_score(y_test, y_pred_xgb),
        precision_score(y_test, y_pred_xgb),
        recall_score(y_test, y_pred_xgb),
        f1_score(y_test, y_pred_xgb)
    ]
}

comparison = pd.DataFrame(
    results,
    index=["Accuracy", "Precision", "Recall", "F1-Score"]
)

print("\n================ MODEL COMPARISON ================")
print(comparison.round(3))

# ============================================================
# 18. FAILURE PROBABILITY
# ============================================================

# Get probability of machine failure
failure_probability = xgb_model.predict_proba(X_test)[:, 1]

print("\nFirst 10 Failure Probabilities:")

for i in range(10):
    print(
        f"Machine {i + 1}: "
        f"{failure_probability[i] * 100:.2f}%"
    )
# ============================================================
# 19. RISK LEVEL
# ============================================================

def get_risk_level(probability):

    if probability < 0.30:
        return "LOW"

    elif probability < 0.60:
        return "MEDIUM"

    else:
        return "HIGH"


print("\nMachine Risk Levels:")

for i in range(10):

    probability = failure_probability[i]

    risk = get_risk_level(probability)

    print(
        f"Machine {i + 1}: "
        f"{probability * 100:.2f}% "
        f"-> {risk} RISK"
    )

# ============================================================
# 20. FEATURE IMPORTANCE
# ============================================================

feature_importance = pd.Series(
    xgb_model.feature_importances_,
    index=X_train.columns
)

feature_importance = feature_importance.sort_values(
    ascending=False
)

print("\nFeature Importance:")

print(feature_importance)   

# ============================================================
# 21. FEATURE IMPORTANCE GRAPH
# ============================================================

plt.figure(figsize=(10, 6))

feature_importance.head(10).sort_values().plot(
    kind="barh"
)

plt.title("Top 10 Features Influencing Machine Failure")
plt.xlabel("Importance")
plt.ylabel("Sensor Feature")

plt.show()

# ============================================================
# 22. MAINTENANCE RECOMMENDATION
# ============================================================

def get_maintenance_recommendation(risk):

    if risk == "LOW":
        return "Continue normal monitoring"

    elif risk == "MEDIUM":
        return "Schedule maintenance inspection"

    else:
        return "Immediate maintenance inspection"


print("\nMaintenance Recommendations:")

for i in range(10):

    probability = failure_probability[i]

    risk = get_risk_level(probability)

    recommendation = get_maintenance_recommendation(risk)

    print(
        f"Machine {i + 1}: "
        f"{risk} RISK -> "
        f"{recommendation}"
    )
# ============================================================
# 23. MACHINE FAILURE PREDICTION FUNCTION
# ============================================================

def predict_machine(sensor_data):

    # Convert sensor data into DataFrame
    input_data = pd.DataFrame([sensor_data])

    # Get failure probability
    probability = xgb_model.predict_proba(input_data)[0][1]

    # Get risk level
    risk = get_risk_level(probability)

    # Get maintenance recommendation
    recommendation = get_maintenance_recommendation(risk)

    return probability, risk, recommendation

# ============================================================
# 24. TEST PREDICTION FUNCTION
# ============================================================

sample_machine = X_test.iloc[0].to_dict()

probability, risk, recommendation = predict_machine(
    sample_machine
)

print("\n================ MACHINE PREDICTION ================")

print(
    f"Failure Probability: {probability * 100:.2f}%"
)

print(
    f"Risk Level: {risk}"
)

print(
    f"Recommendation: {recommendation}"
)


# ============================================================
# 25. THRESHOLD TUNING
# ============================================================

from sklearn.model_selection import train_test_split
from sklearn.metrics import f1_score
import numpy as np

# Split training data into training and validation data
X_train_part, X_validation, y_train_part, y_validation = train_test_split(
    X_train,
    y_train,
    test_size=0.2,
    random_state=42,
    stratify=y_train
)

# Create a temporary XGBoost model
tuning_model = XGBClassifier(
    n_estimators=100,
    max_depth=4,
    learning_rate=0.1,
    scale_pos_weight=scale_pos_weight,
    random_state=42,
    eval_metric="logloss"
)

# Train temporary model
tuning_model.fit(
    X_train_part,
    y_train_part
)

# Get failure probabilities on validation data
validation_probability = tuning_model.predict_proba(
    X_validation
)[:, 1]


# ============================================================
#26 FIND BEST THRESHOLD
# ============================================================

best_threshold = 0.5
best_f1 = 0

for threshold in np.arange(0.10, 0.91, 0.01):

    validation_prediction = (
        validation_probability >= threshold
    ).astype(int)

    current_f1 = f1_score(
        y_validation,
        validation_prediction
    )

    if current_f1 > best_f1:
        best_f1 = current_f1
        best_threshold = threshold


print("\n================ THRESHOLD TUNING ================")

print(
    f"Best Threshold: {best_threshold:.2f}"
)

print(
    f"Validation F1-Score: {best_f1:.3f}"
)
# ============================================================
# 27. FINAL XGBOOST WITH TUNED THRESHOLD
# ============================================================

# Get failure probabilities from our final XGBoost model
test_probability = xgb_model.predict_proba(
    X_test
)[:, 1]

# Apply tuned threshold
y_pred_tuned = (
    test_probability >= best_threshold
).astype(int)


# ============================================================
# EVALUATION
# ============================================================

print("\n================ TUNED XGBOOST ================")

print(
    "\nAccuracy:",
    accuracy_score(y_test, y_pred_tuned)
)

print("\nClassification Report:")

print(
    classification_report(
        y_test,
        y_pred_tuned
    )
)

print("\nConfusion Matrix:")

print(
    confusion_matrix(
        y_test,
        y_pred_tuned
    )
)
# ============================================================
# 28. ROC-AUC EVALUATION
# ============================================================

from sklearn.metrics import roc_auc_score, roc_curve

# Calculate ROC-AUC
roc_auc = roc_auc_score(
    y_test,
    test_probability
)

print("\n================ ROC-AUC ================")

print("ROC-AUC Score:", round(roc_auc, 3))


# Create ROC curve
fpr, tpr, thresholds = roc_curve(
    y_test,
    test_probability
)

plt.figure(figsize=(8, 6))

plt.plot(
    fpr,
    tpr,
    label=f"XGBoost (AUC = {roc_auc:.3f})"
)

plt.plot(
    [0, 1],
    [0, 1],
    linestyle="--"
)

plt.xlabel("False Positive Rate")
plt.ylabel("True Positive Rate")

plt.title("ROC Curve - XGBoost")

plt.legend()

plt.show()

# ============================================================
# 29. PRECISION-RECALL CURVE
# ============================================================

from sklearn.metrics import (
    precision_recall_curve,
    average_precision_score
)

precision, recall, pr_thresholds = precision_recall_curve(
    y_test,
    test_probability
)

average_precision = average_precision_score(
    y_test,
    test_probability
)

print("\n================ PRECISION-RECALL ================")

print(
    "Average Precision Score:",
    round(average_precision, 3)
)


plt.figure(figsize=(8, 6))

plt.plot(
    recall,
    precision,
    label=f"XGBoost (AP = {average_precision:.3f})"
)

plt.xlabel("Recall")
plt.ylabel("Precision")

plt.title("Precision-Recall Curve - XGBoost")

plt.legend()

plt.show()
# ============================================================
# 30. FINAL PREDICTION PIPELINE
# ============================================================

def final_machine_prediction(sensor_data):

    # Convert input into DataFrame
    input_data = pd.DataFrame([sensor_data])

    # Get failure probability
    probability = xgb_model.predict_proba(
        input_data
    )[0][1]

    # Use tuned threshold
    if probability >= best_threshold:
        prediction = "FAILURE"
    else:
        prediction = "NO FAILURE"

    # Risk level
    risk = get_risk_level(probability)

    # Maintenance recommendation
    recommendation = get_maintenance_recommendation(risk)

    # Find important features
    importance = pd.Series(
        xgb_model.feature_importances_,
        index=X_train.columns
    )

    top_features = importance.sort_values(
        ascending=False
    ).head(5)

    return {
        "failure_probability": probability,
        "prediction": prediction,
        "risk_level": risk,
        "top_features": top_features,
        "recommendation": recommendation
    }
# ============================================================
# 31. TEST FINAL PIPELINE
# ============================================================

sample_machine = X_test.iloc[0].to_dict()

result = final_machine_prediction(
    sample_machine
)

print("\n================ FINAL MACHINE PREDICTION ================")

print(
    f"Failure Probability: "
    f"{result['failure_probability'] * 100:.2f}%"
)

print(
    f"Prediction: "
    f"{result['prediction']}"
)

print(
    f"Risk Level: "
    f"{result['risk_level']}"
)

print("\nTop Important Features:")

print(result["top_features"])

print(
    f"\nMaintenance Recommendation: "
    f"{result['recommendation']}"
)
# ============================================================
# 32. SAVE FINAL MODEL
# ============================================================

import joblib

joblib.dump(
    xgb_model,
    "predictive_maintenance_model.pkl"
)

joblib.dump(
    best_threshold,
    "failure_threshold.pkl"
)

print("\nFinal XGBoost model saved successfully!")
print("Final threshold saved successfully!")
# ============================================================
# SECTION 33: SMOTE FOR CLASS IMBALANCE
# ============================================================

from imblearn.over_sampling import SMOTE

print("\n" + "="*60)
print("SMOTE CLASS BALANCING")
print("="*60)

# Check class distribution before SMOTE
print("\nClass distribution BEFORE SMOTE:")
print(y_train.value_counts())

# Create SMOTE object
smote = SMOTE(random_state=42)

# Apply SMOTE ONLY to training data
X_train_smote, y_train_smote = smote.fit_resample(
    X_train,
    y_train
)

# Check class distribution after SMOTE
print("\nClass distribution AFTER SMOTE:")
print(y_train_smote.value_counts())

print("\nTraining data before SMOTE:", X_train.shape)
print("Training data after SMOTE:", X_train_smote.shape)


# ============================================================
# SECTION 34: XGBOOST WITH SMOTE
# ============================================================

print("\n" + "="*60)
print("TRAINING XGBOOST WITH SMOTE")
print("="*60)

# Create XGBoost model
# NOTE: scale_pos_weight is NOT used here
# because SMOTE already balances the training data.

xgb_smote = XGBClassifier(
    n_estimators=100,
    max_depth=4,
    learning_rate=0.1,
    random_state=42,
    eval_metric="logloss"
)

# Train model using SMOTE data
xgb_smote.fit(
    X_train_smote,
    y_train_smote
)

print("\nSMOTE XGBoost training completed.")


# ============================================================
# SECTION 35: EVALUATE SMOTE XGBOOST
# ============================================================

print("\n" + "="*60)
print("SMOTE XGBOOST - DEFAULT THRESHOLD")
print("="*60)

# Predict test data
y_pred_smote = xgb_smote.predict(X_test)

# Confusion matrix
print("\nConfusion Matrix:")
print(confusion_matrix(y_test, y_pred_smote))

# Classification report
print("\nClassification Report:")
print(classification_report(y_test, y_pred_smote))


# ============================================================
# SECTION 36: SMOTE FAILURE PROBABILITY
# ============================================================

# Get probability of failure
y_prob_smote = xgb_smote.predict_proba(X_test)[:, 1]

print("\nFirst 10 failure probabilities:")
print(y_prob_smote[:10])


# ============================================================
# SECTION 37: THRESHOLD TUNING FOR SMOTE XGBOOST
# ============================================================

print("\n" + "="*60)
print("SMOTE XGBOOST - THRESHOLD TUNING")
print("="*60)

from sklearn.metrics import f1_score

# Store best threshold and F1 score
best_threshold_smote = 0.50
best_f1_smote = 0

# Test thresholds from 0.10 to 0.90
for threshold in [i / 100 for i in range(10, 91)]:

    # Convert probabilities into predictions
    y_pred_threshold = (
        y_prob_smote >= threshold
    ).astype(int)

    # Calculate F1 score
    f1 = f1_score(
        y_test,
        y_pred_threshold
    )

    # Check whether this is the best threshold
    if f1 > best_f1_smote:
        best_f1_smote = f1
        best_threshold_smote = threshold


print("\nBest Threshold:", best_threshold_smote)
print("Best F1 Score:", best_f1_smote)


# ============================================================
# SECTION 38: FINAL SMOTE MODEL EVALUATION
# ============================================================

print("\n" + "="*60)
print("SMOTE XGBOOST - TUNED THRESHOLD RESULTS")
print("="*60)

# Make predictions using the best threshold
y_pred_smote_tuned = (
    y_prob_smote >= best_threshold_smote
).astype(int)

# Confusion matrix
print("\nConfusion Matrix:")
print(confusion_matrix(
    y_test,
    y_pred_smote_tuned
))

# Classification report
print("\nClassification Report:")
print(classification_report(
    y_test,
    y_pred_smote_tuned
))


# ============================================================
# SECTION 39: COMPARE OLD AND SMOTE MODEL
# ============================================================

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score
)

# Metrics for SMOTE model
smote_accuracy = accuracy_score(
    y_test,
    y_pred_smote_tuned
)

smote_precision = precision_score(
    y_test,
    y_pred_smote_tuned,
    zero_division=0
)

smote_recall = recall_score(
    y_test,
    y_pred_smote_tuned,
    zero_division=0
)

smote_f1 = f1_score(
    y_test,
    y_pred_smote_tuned,
    zero_division=0
)

print("\n" + "="*60)
print("FINAL SMOTE MODEL METRICS")
print("="*60)

print("\nAccuracy :", round(smote_accuracy, 4))
print("Precision:", round(smote_precision, 4))
print("Recall   :", round(smote_recall, 4))
print("F1 Score :", round(smote_f1, 4))

print("\nBest Threshold:", best_threshold_smote)


# ============================================================
# SECTION 40: SMOTE FEATURE IMPORTANCE
# ============================================================

importance_smote = pd.Series(
    xgb_smote.feature_importances_,
    index=X_train.columns
)

importance_smote = importance_smote.sort_values(
    ascending=False
)

print("\nTop 10 Important Features - SMOTE XGBoost:")
print(importance_smote.head(10))


# Plot feature importance
plt.figure(figsize=(10, 6))

importance_smote.head(10).sort_values().plot(
    kind="barh"
)

plt.title("Top 10 Feature Importance - SMOTE XGBoost")
plt.xlabel("Importance")
plt.ylabel("Features")
plt.tight_layout()
plt.show()
# ============================================================
# SECTION 41: XGBOOST HYPERPARAMETER TUNING
# ============================================================

from sklearn.model_selection import RandomizedSearchCV

print("\n" + "="*60)
print("XGBOOST HYPERPARAMETER TUNING")
print("="*60)

# Base XGBoost model
xgb_tuning = XGBClassifier(
    random_state=42,
    eval_metric="logloss"
)

# Parameters to search
param_grid = {
    "n_estimators": [50, 100, 150, 200, 300],
    "max_depth": [2, 3, 4, 5, 6],
    "learning_rate": [0.01, 0.05, 0.1, 0.15, 0.2],
    "min_child_weight": [1, 3, 5, 7],
    "subsample": [0.7, 0.8, 0.9, 1.0],
    "colsample_bytree": [0.7, 0.8, 0.9, 1.0],
    "gamma": [0, 0.1, 0.3, 0.5]
}

# Randomized search
random_search = RandomizedSearchCV(
    estimator=xgb_tuning,
    param_distributions=param_grid,
    n_iter=30,
    scoring="f1",
    cv=5,
    verbose=1,
    random_state=42,
    n_jobs=-1
)

# IMPORTANT:
# Use the ORIGINAL training data here.
# We are NOT using the SMOTE data for this experiment.

random_search.fit(X_train, y_train)

print("\nBest Parameters:")
print(random_search.best_params_)

print("\nBest Cross-Validation F1 Score:")
print(random_search.best_score_)
# ============================================================
# SECTION 42: TEST TUNED XGBOOST
# ============================================================

best_xgb = random_search.best_estimator_

y_pred_tuned = best_xgb.predict(X_test)

print("\n" + "="*60)
print("TUNED XGBOOST RESULTS")
print("="*60)

print("\nConfusion Matrix:")
print(confusion_matrix(y_test, y_pred_tuned))

print("\nClassification Report:")
print(classification_report(y_test, y_pred_tuned))
# ============================================================
# SECTION 43: THRESHOLD TUNING FOR TUNED XGBOOST
# ============================================================

from sklearn.metrics import f1_score

# Failure probabilities
y_prob_tuned = best_xgb.predict_proba(X_test)[:, 1]

best_threshold_tuned = 0.50
best_f1_tuned = 0

for threshold in [i / 100 for i in range(10, 91)]:

    y_pred_threshold = (
        y_prob_tuned >= threshold
    ).astype(int)

    f1 = f1_score(
        y_test,
        y_pred_threshold
    )

    if f1 > best_f1_tuned:
        best_f1_tuned = f1
        best_threshold_tuned = threshold

print("\nBest Threshold:", best_threshold_tuned)
print("Best F1:", best_f1_tuned)


# Final prediction using tuned threshold
y_pred_tuned_threshold = (
    y_prob_tuned >= best_threshold_tuned
).astype(int)

print("\nConfusion Matrix - Tuned Threshold:")
print(confusion_matrix(
    y_test,
    y_pred_tuned_threshold
))

print("\nClassification Report - Tuned Threshold:")
print(classification_report(
    y_test,
    y_pred_tuned_threshold
))
# ============================================================
# SECTION 44: LEAKAGE-FREE VALIDATION SET
# ============================================================

print("\n" + "="*60)
print("CREATING VALIDATION SET")
print("="*60)

# Split the original training data into:
# 80% actual training
# 20% validation

X_tr, X_val, y_tr, y_val = train_test_split(
    X_train,
    y_train,
    test_size=0.20,
    random_state=42,
    stratify=y_train
)

print("\nTraining data:", X_tr.shape)
print("Validation data:", X_val.shape)
print("Test data:", X_test.shape)

print("\nTraining class distribution:")
print(y_tr.value_counts())

print("\nValidation class distribution:")
print(y_val.value_counts())
# ============================================================
# SECTION 45: LEAKAGE-FREE SMOTE XGBOOST
# ============================================================

print("\n" + "="*60)
print("LEAKAGE-FREE SMOTE XGBOOST")
print("="*60)

# Apply SMOTE ONLY to the training portion
smote_final = SMOTE(random_state=42)

X_tr_smote, y_tr_smote = smote_final.fit_resample(
    X_tr,
    y_tr
)

print("\nBefore SMOTE:")
print(y_tr.value_counts())

print("\nAfter SMOTE:")
print(y_tr_smote.value_counts())


# Train SMOTE XGBoost
xgb_smote_final = XGBClassifier(
    n_estimators=100,
    max_depth=4,
    learning_rate=0.1,
    random_state=42,
    eval_metric="logloss"
)

xgb_smote_final.fit(
    X_tr_smote,
    y_tr_smote
)

print("\nSMOTE XGBoost training completed.")
# ============================================================
# SECTION 46: SMOTE THRESHOLD USING VALIDATION SET
# ============================================================

print("\n" + "="*60)
print("SMOTE THRESHOLD SELECTION")
print("="*60)

# Predict probabilities on VALIDATION data
y_val_prob_smote = xgb_smote_final.predict_proba(
    X_val
)[:, 1]

best_threshold_smote_final = 0.50
best_f1_smote_final = 0

# Search thresholds
for threshold in [i / 100 for i in range(10, 91)]:

    y_val_pred = (
        y_val_prob_smote >= threshold
    ).astype(int)

    f1 = f1_score(
        y_val,
        y_val_pred
    )

    if f1 > best_f1_smote_final:
        best_f1_smote_final = f1
        best_threshold_smote_final = threshold


print("\nBest Validation Threshold:",
      best_threshold_smote_final)

print("Validation F1:",
      round(best_f1_smote_final, 4))
# ============================================================
# SECTION 47: FINAL SMOTE TEST EVALUATION
# ============================================================

print("\n" + "="*60)
print("FINAL SMOTE TEST RESULTS")
print("="*60)

# Predict probabilities on untouched TEST data
y_test_prob_smote = xgb_smote_final.predict_proba(
    X_test
)[:, 1]

# Apply the threshold selected using validation data
y_test_pred_smote_final = (
    y_test_prob_smote >= best_threshold_smote_final
).astype(int)

print("\nChosen Threshold:",
      best_threshold_smote_final)

print("\nConfusion Matrix:")
print(
    confusion_matrix(
        y_test,
        y_test_pred_smote_final
    )
)

print("\nClassification Report:")
print(
    classification_report(
        y_test,
        y_test_pred_smote_final
    )
)
# ============================================================
# SECTION 48: LEAKAGE-FREE TUNED XGBOOST
# ============================================================

print("\n" + "="*60)
print("LEAKAGE-FREE TUNED XGBOOST")
print("="*60)

# Create a new model using the best parameters
best_xgb_final = XGBClassifier(
    **random_search.best_params_,
    random_state=42,
    eval_metric="logloss"
)

# Train ONLY on X_tr / y_tr
best_xgb_final.fit(
    X_tr,
    y_tr
)

print("\nTuned XGBoost training completed.")
# ============================================================
# SECTION 49: TUNED XGBOOST THRESHOLD
# ============================================================

print("\n" + "="*60)
print("TUNED XGBOOST THRESHOLD SELECTION")
print("="*60)

# Validation probabilities
y_val_prob_tuned = best_xgb_final.predict_proba(
    X_val
)[:, 1]

best_threshold_final = 0.50
best_f1_final = 0

for threshold in [i / 100 for i in range(10, 91)]:

    y_val_pred = (
        y_val_prob_tuned >= threshold
    ).astype(int)

    f1 = f1_score(
        y_val,
        y_val_pred
    )

    if f1 > best_f1_final:
        best_f1_final = f1
        best_threshold_final = threshold


print("\nBest Validation Threshold:",
      best_threshold_final)

print("Validation F1:",
      round(best_f1_final, 4))
# ============================================================
# SECTION 50: FINAL TUNED XGBOOST TEST
# ============================================================

print("\n" + "="*60)
print("FINAL TUNED XGBOOST TEST RESULTS")
print("="*60)

# Predict probabilities on untouched test set
y_test_prob_final = best_xgb_final.predict_proba(
    X_test
)[:, 1]

# Use threshold chosen ONLY from validation set
y_test_pred_final = (
    y_test_prob_final >= best_threshold_final
).astype(int)

print("\nChosen Threshold:",
      best_threshold_final)

print("\nConfusion Matrix:")
print(
    confusion_matrix(
        y_test,
        y_test_pred_final
    )
)

print("\nClassification Report:")
print(
    classification_report(
        y_test,
        y_test_pred_final
    )
)   
# ============================================================
# SECTION 51: 5-FOLD STRATIFIED CROSS-VALIDATION
# ============================================================

from sklearn.model_selection import StratifiedKFold, cross_validate

print("\n" + "="*60)
print("5-FOLD STRATIFIED CROSS-VALIDATION")
print("="*60)

# Create 5 stratified folds
skf = StratifiedKFold(
    n_splits=5,
    shuffle=True,
    random_state=42
)

# Models to compare
cv_models = {

    "Logistic Regression": LogisticRegression(
        max_iter=1000
    ),

    "Random Forest": RandomForestClassifier(
        n_estimators=100,
        class_weight="balanced",
        random_state=42
    ),

    "XGBoost": XGBClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        scale_pos_weight=scale_pos_weight,
        random_state=42,
        eval_metric="logloss"
    )
}

# Evaluate each model
for name, model in cv_models.items():

    print("\n" + "-"*60)
    print(name)
    print("-"*60)

    scores = cross_validate(
        model,
        X_train,
        y_train,
        cv=skf,
        scoring={
            "precision": "precision",
            "recall": "recall",
            "f1": "f1"
        },
        n_jobs=-1
    )

    print(
        "Precision: {:.3f} ± {:.3f}".format(
            scores["test_precision"].mean(),
            scores["test_precision"].std()
        )
    )

    print(
        "Recall:    {:.3f} ± {:.3f}".format(
            scores["test_recall"].mean(),
            scores["test_recall"].std()
        )
    )

    print(
        "F1 Score:  {:.3f} ± {:.3f}".format(
            scores["test_f1"].mean(),
            scores["test_f1"].std()
        )
    )

# ============================================================
# SECTION 52: ANOMALY DETECTION - DATA PREPARATION
# ============================================================

from sklearn.ensemble import IsolationForest

print("\n" + "="*60)
print("ANOMALY DETECTION")
print("="*60)

# Use sensor features only
# We don't use machine_failure because anomaly detection
# should work independently of the failure label.

sensor_features = [
    "temperature",
    "vibration",
    "pressure",
    "humidity",
    "rotation_speed",
    "voltage",
    "current",
    "oil_level",
    "load",
    "motor_temperature",
    "gearbox_temperature",
    "sound_level",
    "fan_speed",
    "reactive_power",
    "active_power"
]

X_anomaly = df[sensor_features]

print("\nAnomaly detection features:")
print(sensor_features)

print("\nAnomaly detection data shape:")
print(X_anomaly.shape)
# ============================================================
# SECTION 53: TRAIN ISOLATION FOREST
# ============================================================

print("\n" + "="*60)
print("TRAINING ISOLATION FOREST")
print("="*60)

isolation_forest = IsolationForest(
    n_estimators=100,
    contamination=0.10,
    random_state=42
)

# Train the anomaly detection model
isolation_forest.fit(X_anomaly)

print("\nIsolation Forest training completed.")
# ============================================================
# SECTION 54: DETECT ANOMALIES
# ============================================================

# Isolation Forest returns:
#  1  = normal
# -1  = anomaly

anomaly_prediction = isolation_forest.predict(X_anomaly)

# Convert result to easier labels
df["anomaly"] = anomaly_prediction

df["anomaly_label"] = df["anomaly"].map({
    1: "NORMAL",
    -1: "ANOMALY"
})

print("\nAnomaly counts:")
print(df["anomaly_label"].value_counts())
# ============================================================
# SECTION 55: ANOMALY SCORE
# ============================================================

anomaly_scores = isolation_forest.decision_function(
    X_anomaly
)

df["anomaly_score"] = anomaly_scores

print("\nFirst 10 anomaly scores:")
print(df["anomaly_score"].head(10))
# ============================================================
# SECTION 56: SHOW ANOMALOUS READINGS
# ============================================================

anomalies = df[
    df["anomaly_label"] == "ANOMALY"
]

print("\n" + "="*60)
print("ANOMALOUS SENSOR READINGS")
print("="*60)

print(
    anomalies[
        sensor_features + ["machine_failure", "anomaly_score"]
    ].head(10)
)
# ============================================================
# SECTION 57: ANOMALY VS ACTUAL FAILURE
# ============================================================

print("\n" + "="*60)
print("ANOMALY VS MACHINE FAILURE")
print("="*60)

comparison = pd.crosstab(
    df["anomaly_label"],
    df["machine_failure"]
)

print(comparison)
# ============================================================
# SECTION 58: ANOMALY SCORE VISUALIZATION
# ============================================================

plt.figure(figsize=(12, 6))

plt.plot(
    df.index,
    df["anomaly_score"]
)

plt.axhline(
    0,
    linestyle="--"
)

plt.title("Isolation Forest Anomaly Scores")
plt.xlabel("Machine Reading Index")
plt.ylabel("Anomaly Score")

plt.tight_layout()
plt.show()
# ============================================================
# SECTION 59: ISOLATION FOREST - NORMAL OPERATION MODEL
# ============================================================

print("\n" + "="*60)
print("ISOLATION FOREST - NORMAL OPERATION")
print("="*60)

# Use only machines that did NOT fail
normal_data = df[df["machine_failure"] == 0]

X_normal = normal_data[sensor_features]

print("\nNormal training data shape:")
print(X_normal.shape)

# Create Isolation Forest
isolation_forest_normal = IsolationForest(
    n_estimators=100,
    contamination=0.10,
    random_state=42
)

# Train only on normal machine behavior
isolation_forest_normal.fit(X_normal)

print("\nIsolation Forest trained on normal operation.")
# ============================================================
# SECTION 60: DETECT ANOMALIES
# ============================================================

# Calculate anomaly predictions
normal_model_prediction = isolation_forest_normal.predict(
    X_anomaly
)

# Convert to readable labels
df["anomaly_normal_model"] = normal_model_prediction

df["anomaly_normal_label"] = df[
    "anomaly_normal_model"
].map({
    1: "NORMAL",
    -1: "ANOMALY"
})

print("\nAnomaly counts:")
print(
    df["anomaly_normal_label"].value_counts()
)
# ============================================================
# SECTION 61: ANOMALY SCORE
# ============================================================

normal_anomaly_score = (
    isolation_forest_normal
    .decision_function(X_anomaly)
)

df["normal_anomaly_score"] = normal_anomaly_score

print("\nFirst 10 anomaly scores:")
print(
    df["normal_anomaly_score"].head(10)
)
# ============================================================
# SECTION 62: ANOMALY VS MACHINE FAILURE
# ============================================================

print("\n" + "="*60)
print("NORMAL MODEL: ANOMALY VS MACHINE FAILURE")
print("="*60)

comparison_normal = pd.crosstab(
    df["anomaly_normal_label"],
    df["machine_failure"]
)

print(comparison_normal)
# ============================================================
# SECTION 63: ANOMALY DETECTION STATISTICS
# ============================================================

anomaly_mask = (
    df["anomaly_normal_label"] == "ANOMALY"
)

failure_mask = (
    df["machine_failure"] == 1
)

# How many actual failures were detected as anomalies?
failure_anomalies = (
    anomaly_mask & failure_mask
).sum()

total_failures = failure_mask.sum()

# How many anomalies were actually failures?
total_anomalies = anomaly_mask.sum()

precision_anomaly = (
    failure_anomalies / total_anomalies
    if total_anomalies > 0 else 0
)

recall_anomaly = (
    failure_anomalies / total_failures
    if total_failures > 0 else 0
)

print("\nTotal anomalies:", total_anomalies)

print(
    "Failures detected as anomalies:",
    failure_anomalies
)

print(
    "Anomaly precision:",
    round(precision_anomaly, 3)
)

print(
    "Anomaly recall:",
    round(recall_anomaly, 3)
)
# ============================================================
# SECTION 64: PROCESS OPTIMIZATION - WHAT-IF SIMULATOR
# ============================================================

print("\n" + "="*60)
print("PROCESS OPTIMIZATION - WHAT-IF SIMULATOR")
print("="*60)

# Use the leakage-free tuned XGBoost model
optimization_model = best_xgb_final

# Use the threshold selected using validation data
optimization_threshold = best_threshold_final


# ------------------------------------------------------------
# Function to calculate failure probability
# ------------------------------------------------------------

def calculate_failure_probability(sensor_data):

    input_data = pd.DataFrame([sensor_data])

    # Make sure columns are in exactly the same order
    # used during model training
    input_data = input_data[X_train.columns]

    probability = optimization_model.predict_proba(
        input_data
    )[0][1]

    return probability    
# ============================================================
# SECTION 65: CREATE WHAT-IF SCENARIO
# ============================================================

# Take one machine reading from the dataset

original_row = df.iloc[120].copy()

# Create a dictionary using the model features
current_condition = {}

for feature in X_train.columns:
    current_condition[feature] = original_row[feature]

# Calculate current failure probability
current_probability = calculate_failure_probability(
    current_condition
)

print("\nCurrent Machine Condition")
print("-------------------------")

print("Temperature:",
      current_condition["temperature"])

print("Vibration:",
      current_condition["vibration"])

print("Load:",
      current_condition["load"])

print(
    "\nCurrent Failure Probability:",
    round(current_probability * 100, 2),
    "%"
)
# ============================================================
# SECTION 66: TEST DIFFERENT OPERATING CONDITIONS
# ============================================================

scenarios = []

# Scenario 1 - Current condition
scenario_1 = current_condition.copy()

scenarios.append({
    "Scenario": "Current",
    "Temperature": scenario_1["temperature"],
    "Vibration": scenario_1["vibration"],
    "Load": scenario_1["load"],
    "Failure Probability":
        calculate_failure_probability(scenario_1)
})


# Scenario 2 - Reduce load
scenario_2 = current_condition.copy()

scenario_2["load"] = scenario_2["load"] * 0.90

scenarios.append({
    "Scenario": "Reduce Load 10%",
    "Temperature": scenario_2["temperature"],
    "Vibration": scenario_2["vibration"],
    "Load": scenario_2["load"],
    "Failure Probability":
        calculate_failure_probability(scenario_2)
})


# Scenario 3 - Reduce temperature
scenario_3 = current_condition.copy()

scenario_3["temperature"] = (
    scenario_3["temperature"] - 5
)

scenarios.append({
    "Scenario": "Reduce Temperature 5",
    "Temperature": scenario_3["temperature"],
    "Vibration": scenario_3["vibration"],
    "Load": scenario_3["load"],
    "Failure Probability":
        calculate_failure_probability(scenario_3)
})


# Scenario 4 - Reduce vibration
scenario_4 = current_condition.copy()

scenario_4["vibration"] = (
    scenario_4["vibration"] * 0.90
)

scenarios.append({
    "Scenario": "Reduce Vibration 10%",
    "Temperature": scenario_4["temperature"],
    "Vibration": scenario_4["vibration"],
    "Load": scenario_4["load"],
    "Failure Probability":
        calculate_failure_probability(scenario_4)
})


# Scenario 5 - Combined improvement
scenario_5 = current_condition.copy()

scenario_5["load"] = (
    scenario_5["load"] * 0.90
)

scenario_5["temperature"] = (
    scenario_5["temperature"] - 5
)

scenario_5["vibration"] = (
    scenario_5["vibration"] * 0.90
)

scenarios.append({
    "Scenario": "Combined Improvement",
    "Temperature": scenario_5["temperature"],
    "Vibration": scenario_5["vibration"],
    "Load": scenario_5["load"],
    "Failure Probability":
        calculate_failure_probability(scenario_5)
})
# ============================================================
# SECTION 67: WHAT-IF RESULTS
# ============================================================

optimization_results = pd.DataFrame(scenarios)

# Convert probability to percentage
optimization_results[
    "Failure Probability"
] = (
    optimization_results["Failure Probability"] * 100
)

print("\n" + "="*60)
print("WHAT-IF OPTIMIZATION RESULTS")
print("="*60)

print(
    optimization_results.to_string(
        index=False
    )
)
# ============================================================
# SECTION 68: BEST OPERATING SCENARIO
# ============================================================

best_scenario = optimization_results.loc[
    optimization_results["Failure Probability"].idxmin()
]

print("\n" + "="*60)
print("RECOMMENDED OPERATING CONDITION")
print("="*60)

print(
    "\nRecommended Scenario:",
    best_scenario["Scenario"]
)

print(
    "Predicted Failure Probability:",
    round(
        best_scenario["Failure Probability"],
        2
    ),
    "%"
)
# ============================================================
# SECTION 69: OPTIMIZATION IMPROVEMENT
# ============================================================

original_probability = optimization_results[
    optimization_results["Scenario"] == "Current"
]["Failure Probability"].iloc[0]

best_probability = best_scenario[
    "Failure Probability"
]

improvement = (
    original_probability - best_probability
)

print("\n" + "="*60)
print("PROCESS OPTIMIZATION IMPROVEMENT")
print("="*60)

print(
    "\nOriginal Failure Probability:",
    round(original_probability, 2),
    "%"
)

print(
    "Optimized Failure Probability:",
    round(best_probability, 2),
    "%"
)

print(
    "Predicted Reduction:",
    round(improvement, 2),
    "percentage points"
)
# ============================================================
# SECTION 70: CONSTRAINED WHAT-IF OPTIMIZATION
# ============================================================

print("\n" + "="*60)
print("CONSTRAINED WHAT-IF OPTIMIZATION")
print("="*60)

# Get minimum and maximum values from the original dataset
temperature_min = df["temperature"].min()
temperature_max = df["temperature"].max()

vibration_min = df["vibration"].min()
vibration_max = df["vibration"].max()

load_min = df["load"].min()
load_max = df["load"].max()

print("\nAllowed ranges from dataset:")
print("Temperature:", round(temperature_min, 2), "to", round(temperature_max, 2))
print("Vibration:  ", round(vibration_min, 2), "to", round(vibration_max, 2))
print("Load:       ", round(load_min, 2), "to", round(load_max, 2))


# ------------------------------------------------------------
# Generate realistic small changes
# ------------------------------------------------------------

optimization_scenarios = []

load_changes = [0, -0.05, -0.10]
temperature_changes = [0, -2, -5]
vibration_changes = [0, -0.05, -0.10]


for load_change in load_changes:

    for temperature_change in temperature_changes:

        for vibration_change in vibration_changes:

            scenario = current_condition.copy()

            # Apply changes
            scenario["load"] = (
                current_condition["load"]
                * (1 + load_change)
            )

            scenario["temperature"] = (
                current_condition["temperature"]
                + temperature_change
            )

            scenario["vibration"] = (
                current_condition["vibration"]
                * (1 + vibration_change)
            )

            # Check that values remain inside dataset range
            if not (
                load_min <= scenario["load"] <= load_max
                and temperature_min <= scenario["temperature"] <= temperature_max
                and vibration_min <= scenario["vibration"] <= vibration_max
            ):
                continue

            probability = calculate_failure_probability(
                scenario
            )

            optimization_scenarios.append({
                "Load Change": load_change * 100,
                "Temperature Change": temperature_change,
                "Vibration Change": vibration_change * 100,
                "Temperature": scenario["temperature"],
                "Vibration": scenario["vibration"],
                "Load": scenario["load"],
                "Failure Probability": probability * 100
            })


# Convert to DataFrame
constrained_results = pd.DataFrame(
    optimization_scenarios
)

# Sort by lowest predicted failure probability
constrained_results = constrained_results.sort_values(
    by="Failure Probability"
)

print("\nTop 10 lowest-risk scenarios:")
print(
    constrained_results.head(10).to_string(
        index=False
    )
)
# ============================================================
# SECTION 71: BEST CONSTRAINED SCENARIO
# ============================================================

best_constrained = constrained_results.iloc[0]

print("\n" + "="*60)
print("BEST CONSTRAINED OPERATING CONDITION")
print("="*60)

print(
    "\nLoad change:",
    best_constrained["Load Change"],
    "%"
)

print(
    "Temperature change:",
    best_constrained["Temperature Change"]
)

print(
    "Vibration change:",
    best_constrained["Vibration Change"],
    "%"
)

print(
    "\nPredicted Failure Probability:",
    round(
        best_constrained["Failure Probability"],
        2
    ),
    "%"
)
# ============================================================
# SECTION 72: SAVE MODEL FEATURES
# ============================================================

joblib.dump(
    X_train.columns.tolist(),
    "feature_columns.pkl"
)

print("\nFeature columns saved successfully.")