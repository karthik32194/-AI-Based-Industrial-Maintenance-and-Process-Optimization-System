# AI Maintenance & Optimization System — Backend

A FastAPI backend for an AI-based industrial maintenance platform combining
ML anomaly detection, failure-risk prediction, RAG knowledge retrieval, and
LLM-generated maintenance recommendations.

---

## Architecture

```
Users → Frontend → FastAPI API Layer → Service Layer
      → ML/Data Layer + RAG/Knowledge/LLM Layer
      → PostgreSQL + pgvector
      → Observability (structlog, request IDs, latency)
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Language | Python 3.11 |
| Backend | FastAPI |
| Validation | Pydantic v2 |
| ORM | SQLAlchemy 2 |
| Database | PostgreSQL 16 |
| Vector Storage | pgvector |
| Migrations | Alembic |
| ML | scikit-learn (IsolationForest + HistGradientBoostingClassifier) |
| Data Processing | Pandas, NumPy |
| LLM | OpenAI GPT-4o |
| Embeddings | OpenAI text-embedding-3-small |
| Auth | JWT (python-jose) + bcrypt |
| Logging | structlog (JSON + console) |
| Package Manager | uv |
| Containerisation | Docker + docker-compose |
| Testing | Pytest |

---

## Project Structure

```
backend/
├── app/
│   ├── main.py               # FastAPI app factory, routers, middleware
│   ├── api/
│   │   ├── auth.py           # POST /register, POST /login, GET /me
│   │   ├── machines.py       # Machine CRUD
│   │   ├── sensors.py        # Sensor data ingestion + history
│   │   ├── maintenance.py    # Maintenance records
│   │   ├── predictions.py    # ML inference + anomaly history
│   │   ├── ai.py             # AI recommendations + knowledge search
│   │   └── deps.py           # JWT auth + RBAC dependencies
│   ├── core/
│   │   ├── config.py         # Pydantic Settings
│   │   ├── security.py       # bcrypt + JWT
│   │   ├── exceptions.py     # Domain exceptions + handlers
│   │   └── logging.py        # structlog configuration
│   ├── models/               # SQLAlchemy ORM models
│   ├── schemas/              # Pydantic request/response schemas
│   ├── services/             # Business logic layer
│   │   ├── machine_service.py
│   │   ├── sensor_service.py
│   │   ├── maintenance_service.py
│   │   ├── prediction_service.py
│   │   └── ai_service.py
│   ├── ml/                   # ML pipeline
│   │   ├── contract.py       # ML data contract (15-var feature schema)
│   │   ├── preprocessing.py  # Fitted median imputation (train-only)
│   │   ├── features.py       # (legacy 5-channel engineered path; superseded)
│   │   ├── anomaly.py        # IsolationForest (contamination 0.05)
│   │   ├── prediction.py     # HistGradientBoostingClassifier failure-risk
│   │   ├── service.py        # ML integration boundary (ML_UNAVAILABLE safe)
│   │   └── evaluation.py     # Metrics
│   ├── rag/                  # RAG pipeline
│   │   ├── loader.py         # PDF / DOCX / TXT loading
│   │   ├── chunker.py        # Overlapping text chunking
│   │   ├── embeddings.py     # OpenAI embeddings (batched)
│   │   ├── retriever.py      # pgvector cosine search
│   │   └── pipeline.py       # Full ingestion orchestration
│   └── db/
│       ├── database.py       # Engine + pgvector bootstrap + init_db
│       └── session.py        # get_db dependency
├── alembic/                  # Database migrations
│   └── versions/
│       └── 0001_initial_schema.py
├── tests/                    # Pytest test suite
├── data/knowledge/           # Place maintenance PDFs/SOPs here
├── models/                   # Trained ML model files (.pkl)
├── .env.example              # Environment variable template
├── pyproject.toml            # Dependencies
├── Dockerfile
└── docker-compose.yml
```

---

## Quick Start

### 1. Prerequisites

- Python 3.11+
- PostgreSQL 16 with the pgvector extension
- An OpenAI API key (optional — the system works without it using rule-based fallbacks)

### 2. Clone and configure

```bash
cd backend
cp .env.example .env
# Edit .env and set your DATABASE_URL, SECRET_KEY, and OPENAI_API_KEY
```

### 3. Install dependencies

```bash
# Using uv (recommended)
pip install uv
uv pip install -e ".[dev]"

# Or using pip
pip install -e ".[dev]"
```

### 4. Run database migrations

```bash
alembic upgrade head
```

### 5. Start the development server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs available at: **http://localhost:8000/docs**

---

## Docker Deployment

```bash
# Start the full stack (PostgreSQL + pgvector + backend)
docker-compose up --build

# Run migrations inside the container
docker-compose exec backend alembic upgrade head
```

---

## API Endpoints

| Area | Method | Path |
|---|---|---|
| Auth | POST | `/api/auth/register` |
| Auth | POST | `/api/auth/login` |
| Auth | GET | `/api/auth/me` |
| Machines | POST | `/api/machines` |
| Machines | GET | `/api/machines` |
| Machines | GET | `/api/machines/{id}` |
| Machines | PUT | `/api/machines/{id}` |
| Machines | DELETE | `/api/machines/{id}` |
| Sensors | POST | `/api/machines/{id}/sensor-readings` |
| Sensors | GET | `/api/machines/{id}/sensor-readings` |
| Maintenance | POST | `/api/machines/{id}/maintenance` |
| Maintenance | GET | `/api/machines/{id}/maintenance` |
| Maintenance | PATCH | `/api/machines/{id}/maintenance/{record_id}` |
| Predictions | POST | `/api/machines/{id}/predict` |
| Predictions | GET | `/api/machines/{id}/predictions` |
| Anomalies | GET | `/api/machines/{id}/anomalies` |
| AI | POST | `/api/machines/{id}/recommendation` |
| AI | GET | `/api/machines/{id}/recommendations` |
| Knowledge | POST | `/api/knowledge/search` |
| Knowledge | GET | `/api/knowledge/documents` |
| Knowledge | POST | `/api/knowledge/ingest` |
| Health | GET | `/health` |

---

## User Roles

| Role | Access |
|---|---|
| `ADMIN` | Full application management |
| `MAINTENANCE_ENGINEER` | Machine monitoring, predictions, maintenance records, AI recommendations |
| `OPERATOR` | Read-only: machine status, sensor data, health, anomalies |

---

## ML Pipeline

The ML pipeline runs automatically when `POST /api/machines/{id}/predict` is called:

1. Load latest sensor reading (or use provided values)
2. **Canonical mapping** — build the 15-variable representation the artifacts consume (`rotation_speed`→`rpm`, `active_power`→`power_consumption`; see `app/ml/contract.py`)
3. **Preprocess** — artifact-carried fitted median imputation (learned on training only); no scaling, no engineered features
4. **Anomaly detection** — IsolationForest (unsupervised, `contamination=0.05` operating assumption)
5. **Failure prediction** — HistGradientBoostingClassifier (`class_weight='balanced'`, operating threshold `0.15`)
6. **Health score** — derived from the failure risk score; both are risk/indicator scores, not calibrated probabilities (0–100)
7. Persist prediction + anomaly records (`ml_status` VALID or UNAVAILABLE; never silently healthy)

Train models via the scripts:
```bash
python scripts/train_models.py
```

---

## RAG Knowledge Base

Place maintenance documents in `data/knowledge/` then ingest via the API:

```bash
# Via API (admin token required)
curl -X POST http://localhost:8000/api/knowledge/ingest \
  -H "Authorization: Bearer <token>" \
  -F "file=@data/knowledge/machine_manual.pdf" \
  -F "doc_type=manual"
```

Supported initial documents (Section 17.1):
- `machine_manual.pdf`
- `maintenance_sop.pdf`
- `bearing_troubleshooting.pdf`
- `preventive_maintenance.pdf`
- `corrective_maintenance.pdf`
- `safety_procedure.pdf`

---

## Running Tests

```bash
# All tests
pytest

# With coverage report
pytest --cov=app --cov-report=html

# Specific test files
pytest tests/test_auth.py tests/test_ml.py -v
```

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/ai_maintenance_db` |
| `SECRET_KEY` | JWT signing key (min 32 chars) | `changeme` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT expiry | `60` |
| `OPENAI_API_KEY` | OpenAI API key | *(empty — fallbacks active)* |
| `OPENAI_MODEL` | LLM model name | `gpt-4o` |
| `OPENAI_EMBEDDING_MODEL` | Embedding model | `text-embedding-3-small` |
| `ENVIRONMENT` | `development` or `production` | `development` |
| `DEBUG` | Enable debug logging + SQL echo | `false` |
| `LOG_LEVEL` | Logging level | `INFO` |
| `RAG_TOP_K` | Number of chunks to retrieve | `5` |
| `ML_ANOMALY_CONTAMINATION` | Legacy/unused setting; the anomaly artifact uses the fixed operating constant `0.05` | `0.1` |

---

## Core Principle

> **ML predicts** machine condition →
> **RAG retrieves** relevant maintenance knowledge →
> **LLM explains and recommends** →
> **Human maintenance engineer** makes the final decision.

---

## 8-Week Milestone Alignment

| Milestone | Week | Status |
|---|---|---|
| Requirements, architecture, DB, backend foundation | Week 2 | ✅ Complete |
| ML dataset, preprocessing, anomaly detection, failure prediction | Week 4 | ✅ Complete |
| Knowledge base, RAG pipeline, AI explanation + recommendation | Week 6 | ✅ Complete |
| Dashboard integration, observability, testing, deployment | Week 8 | Backend ready |
