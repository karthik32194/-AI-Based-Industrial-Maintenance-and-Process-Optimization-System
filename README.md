# AI-Based Industrial Maintenance and Process Optimization System

An intelligent industrial maintenance platform integrating machine learning, sensor data analytics, and web technologies to support predictive maintenance, anomaly detection, and process optimization.

## 🌟 Key Capabilities

- **Machine Monitoring:** Manage machine information and analyze industrial sensor readings.
- **Predictive Maintenance:** Estimate machine failure risk using supervised machine learning models.
- **Anomaly Detection:** Identify unusual operating patterns using Isolation Forest.
- **Process Optimization:** Support analysis of machine operating parameters and potential improvements.
- **AI-Powered Maintenance Assistance:** Retrieve relevant technical information using a Retrieval-Augmented Generation (RAG) workflow, where configured.
- **Interactive Dashboard:** Visualize machine status, predictions, and analytical results.
- **Secure Authentication:** Support authenticated access to application features.
- **Persistent Data Management:** Store application records using PostgreSQL.

## 🏗️ System Architecture

The application follows a modular architecture that separates the user interface, backend services, machine learning components, and data storage.

```text
                User / Technician
                       |
                       v
             Next.js Frontend
           React + TypeScript
                       |
                       v
                FastAPI Backend
                       |
          +------------+------------+
          |            |            |
          v            v            v
     Machine API   ML Services   AI Assistant
          |            |        (RAG / LLM)
          |            |            |
          |      +-----+-----+      v
          |      |           |   pgvector
          |      v           v
          |  Failure Risk  Isolation
          |  Prediction    Forest
          |      |           |
          +------+-----------+
                       |
                       v
                 PostgreSQL
```

## 📁 Project Structure

The exact structure may vary depending on the repository implementation.

```text
project-root/
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── public/
│   ├── package.json
│   └── README.md
│
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── main.py
│   ├── alembic/
│   ├── requirements.txt
│   └── README.md
│
├── data/
│   └── simulated_iiot_dataset.csv
│
└── README.md
```

## 📊 Dataset & Preprocessing

The machine learning pipeline uses a simulated Industrial Internet of Things (IIoT) dataset containing machine sensor readings and failure labels.

**Input features may include:**
- Temperature
- Vibration
- Pressure
- Humidity
- Active power
- Reactive power
- Timestamp

**Preprocessing pipeline:**

1. Validate sensor data and handle missing values.
2. Convert timestamps into datetime features.
3. Perform feature engineering to extract useful patterns.
4. Split the dataset into training and evaluation sets.
5. Apply class-imbalance handling to the training data where required.
6. Evaluate models using appropriate classification metrics.

## 🤖 Model Specifications

| Model / Technique | Purpose |
|---|---|
| Logistic Regression | Baseline failure classification |
| Decision Tree | Classification using learned decision rules |
| Random Forest | Failure classification using an ensemble of trees |
| XGBoost | Gradient-boosted failure classification |
| Isolation Forest | Unsupervised anomaly detection |
| SMOTE | Address class imbalance during model training |

**Evaluation metrics:** Precision, recall, F1-score, confusion matrix, and ROC-AUC or PR-AUC where applicable.

Model performance must be reported using the final leakage-free evaluation results. Because the dataset is simulated and relatively small, the results represent an initial experiment rather than proof of industrial reliability.

## ⚙️ Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Backend | Python, FastAPI, Pydantic |
| Database | PostgreSQL |
| ORM and Migrations | SQLAlchemy, Alembic |
| Machine Learning | Scikit-learn, XGBoost |
| Data Processing | Pandas, NumPy |
| Anomaly Detection | Isolation Forest |
| Vector Search | pgvector |
| Authentication | JWT, bcrypt |
| Testing and Deployment | Pytest, Docker |

## 🔌 FastAPI Endpoints

The backend exposes REST API endpoints for frontend integration. The table below shows example endpoint roles; verify the actual routes in the backend before using these paths as documentation.

| Endpoint example | Method | Purpose |
|---|---|---|
| `/health` | GET | Check backend availability |
| `/auth/register` | POST | Register a user |
| `/auth/login` | POST | Authenticate a user |
| `/machines` | GET | Retrieve machine records |
| `/machines` | POST | Register a machine |
| `/predictions` | POST | Request a failure prediction |

**Note:** These paths are illustrative, not a verified list of the project's implemented endpoints. Check the FastAPI Swagger documentation at `/docs` for the actual routes.

## 🚀 Quickstart Guide

### Prerequisites

- Python and pip
- Node.js and npm
- PostgreSQL
- Git
- Docker (optional)

### 1. Clone the Repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd <YOUR_PROJECT_DIRECTORY>
```

Replace the placeholders with the actual repository URL and directory name.

### 2. Configure the Backend

Open a terminal in the backend directory:

```bash
python -m venv venv
```

Activate the environment on Windows:

```bash
venv\Scripts\activate
```

Install the dependencies:

```bash
pip install -r requirements.txt
```

Configure the database connection and other required environment variables according to the project's configuration.

### 3. Initialize the Database

If PostgreSQL and Alembic are configured, apply the existing migrations:

```bash
alembic upgrade head
```

Run this from the directory containing the Alembic configuration.

### 4. Start the Backend

For a project whose FastAPI entry point is `app/main.py`:

```bash
uvicorn app.main:app --reload
```

Open the API documentation at:

http://127.0.0.1:8000/docs

Adjust the import path if the actual entry point differs.

### 5. Start the Frontend

Open a separate terminal in the frontend directory:

```bash
npm install
npm run dev
```

Open:

http://localhost:3000

### 6. Verify the Integration

- Confirm the backend is running.
- Confirm PostgreSQL is accessible.
- Check that the frontend uses the correct backend API URL.
- Test authentication and machine APIs.
- Verify prediction and anomaly-detection responses.
- Test RAG functionality separately if it is enabled.

## 🔬 Limitations & Future Work

- Validate model performance using larger, real-world industrial datasets.
- Test generalization across different machines and operating conditions.
- Monitor false alarms and missed failures.
- Integrate live IIoT sensor streams where feasible.
- Validate process optimization recommendations against engineering constraints.
- Test document ingestion, vector retrieval, and AI answer generation end to end.

## 🎯 Project Objective

To develop a modular industrial intelligence platform that combines machine monitoring, machine learning-based failure-risk estimation, anomaly detection, and maintenance knowledge assistance to support data-driven maintenance decisions.

## ⚠️ Disclaimer

This project is an engineering prototype based on simulated data. Predictions and recommendations require further validation before use in real industrial operations.
