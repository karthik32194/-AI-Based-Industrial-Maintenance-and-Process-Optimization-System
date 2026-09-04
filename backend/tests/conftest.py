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
