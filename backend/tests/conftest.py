"""
Pytest configuration and shared fixtures.
Uses an in-memory SQLite database for fast, isolated unit/integration tests.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import get_db
from app.main import app
from app.models.base import Base

# SQLite in-memory DB — no PostgreSQL required for unit tests
TEST_DATABASE_URL = "sqlite:///./test.db"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def create_test_tables():
    """Create all tables once per test session, drop after."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session():
    """Yield a test database session that rolls back after each test."""
    connection = test_engine.connect()
    transaction = connection.begin()
    session = TestSessionLocal(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session):
    """Return a TestClient with the test DB session injected."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def admin_token(client):
    """Register and log in an admin user, return the JWT token."""
    client.post("/api/auth/register", json={
        "name": "Test Admin",
        "email": "admin@test.com",
        "password": "TestPass1",
        "role": "ADMIN",
    })
    response = client.post("/api/auth/login", json={
        "email": "admin@test.com",
        "password": "TestPass1",
    })
    return response.json()["access_token"]


@pytest.fixture
def auth_headers(admin_token):
    """Return Authorization headers for authenticated requests."""
    return {"Authorization": f"Bearer {admin_token}"}


# ---------------------------------------------------------------------------
# ML artifact isolation (Phase 6 -- test hygiene / handoff safety)
# ---------------------------------------------------------------------------
#
# Phase 6 final audit found that the ML training functions
# (app.ml.prediction.train_failure_model, app.ml.anomaly.train_anomaly_model)
# unconditionally PERSIST their model to the production path (models/*.pkl).
# Any test that trains a model -- even a tiny toy -- therefore overwrote the
# real shipped artifacts, corrupting the deployed failure-risk and anomaly
# models whenever the test suite ran.
#
# This session-scoped fixture redirects those save/load operations to a
# per-session temporary directory, so the test suite NEVER writes to or reads
# from models/. Real artifacts are left untouched by tests. Behavior of the
# training functions themselves is unchanged (default path still models/);
# only the module-level save/load hooks that tests trigger are redirected.
@pytest.fixture(scope="session", autouse=True)
def _isolate_ml_artifacts(tmp_path_factory):
    import app.ml.anomaly as _am
    import app.ml.prediction as _pm

    tmp = tmp_path_factory.mktemp("ml_artifacts")
    f_art_path = tmp / "failure_risk_artifact.pkl"
    a_art_path = tmp / "anomaly_artifact.pkl"

    _orig_save_p = _pm.save_failure_risk_artifact
    _orig_save_a = _am.save_anomaly_artifact
    _orig_load_p = _pm.load_failure_risk_artifact
    _orig_load_a = _am.load_anomaly_artifact

    # Redirect default-path save/load to the temp dir (caller-supplied explicit
    # paths -- e.g. artifact-reload tests -- are passed straight through).
    _pm.save_failure_risk_artifact = (
        lambda art, path=None: _orig_save_p(art, path or f_art_path)
    )
    _am.save_anomaly_artifact = (
        lambda art, path=None: _orig_save_a(art, path or a_art_path)
    )
    _pm.load_failure_risk_artifact = (
        lambda path=None: _orig_load_p(path or f_art_path)
    )
    _am.load_anomaly_artifact = (
        lambda path=None: _orig_load_a(path or a_art_path)
    )

    yield

    _pm.save_failure_risk_artifact = _orig_save_p
    _am.save_anomaly_artifact = _orig_save_a
    _pm.load_failure_risk_artifact = _orig_load_p
    _am.load_anomaly_artifact = _orig_load_a
