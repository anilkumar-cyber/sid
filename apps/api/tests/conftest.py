import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import hash_password
from app.main import app
from app.models import *  # noqa: F401,F403

TEST_DATABASE_URL = settings.DATABASE_URL.rsplit("/", 1)[0] + "/sidbwood_test"


def _ensure_test_database() -> None:
    admin_engine = create_engine(settings.DATABASE_URL.rsplit("/", 1)[0] + "/postgres", isolation_level="AUTOCOMMIT")
    with admin_engine.connect() as conn:
        exists = conn.execute(text("SELECT 1 FROM pg_database WHERE datname = 'sidbwood_test'")).scalar()
        if not exists:
            conn.execute(text("CREATE DATABASE sidbwood_test"))
    admin_engine.dispose()


_ensure_test_database()
engine = create_engine(TEST_DATABASE_URL, future=True)
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
TestSessionLocal = sessionmaker(autoflush=False, autocommit=False, future=True, join_transaction_mode="create_savepoint")


@pytest.fixture()
def db():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def make_user(db):
    from app.core.constants import Role, UserStatus
    from app.models.user import User

    def _make(email: str, role: Role, home_branch_id=None, password: str = "Welcome@123") -> User:
        user = User(
            email=email, full_name=email.split("@")[0], hashed_password=hash_password(password),
            role=role, status=UserStatus.ACTIVE, home_branch_id=home_branch_id,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    return _make


@pytest.fixture()
def make_branch(db):
    from app.models.branch import Branch

    def _make(name: str = "Test Branch", code: str = "TST") -> Branch:
        branch = Branch(name=name, code=code)
        db.add(branch)
        db.commit()
        db.refresh(branch)
        return branch

    return _make


def auth_headers(client: TestClient, email: str, password: str = "Welcome@123") -> dict:
    resp = client.post("/api/v1/auth/login", data={"username": email, "password": password})
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
