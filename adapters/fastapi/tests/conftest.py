from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from hull_fastapi.config import Settings
from hull_fastapi.db import apply_migrations, connection
from hull_fastapi.api import create_app


def _database_url() -> str | None:
    return os.environ.get("HULL_DATABASE_URL") or os.environ.get("DATABASE_URL")


@pytest.fixture(scope="session")
def settings() -> Settings:
    url = _database_url()
    if not url:
        pytest.skip("HULL_DATABASE_URL is not set")
    # Isolate from the product database.
    if url.rstrip("/").endswith("/hull") and "hull_test" not in url:
        url = url.rsplit("/", 1)[0] + "/hull_test"
    s = Settings(database_url=url, s3_endpoint="", smtp_host="", host="hull.test")
    apply_migrations(s)
    return s


@pytest.fixture
def client(settings: Settings) -> TestClient:
    app = create_app(settings)
    return TestClient(app)


@pytest.fixture
def unique() -> str:
    return uuid.uuid4().hex[:10]
