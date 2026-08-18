from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from hull_fastapi.api import create_app
from hull_fastapi.config import Settings
from hull_fastapi.db import connection


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
    # scripts/migrate.sh is the only migration runner (AGENTS.md). scripts/test.sh
    # runs it against this database before pytest starts.
    with connection(s) as conn, conn.cursor() as cur:
        cur.execute("SELECT to_regclass('public.users') AS t")
        row = cur.fetchone()
        if not row or not row["t"]:
            pytest.skip("schema not applied — run scripts/test.sh (or scripts/migrate.sh) first")
    return s


@pytest.fixture
def client(settings: Settings) -> TestClient:
    app = create_app(settings)
    return TestClient(app)


@pytest.fixture
def unique() -> str:
    return uuid.uuid4().hex[:10]


@pytest.fixture
def confirm_email(settings: Settings):
    """Mark an address confirmed, without walking the link.

    The product is closed until an address is verified, so most tests here need a
    confirmed account to reach anything — and having twenty of them each redeem a
    token would be twenty copies of a flow that `test_email_verification.py`
    already owns, all of them failing together the day it changes.

    Deliberately the column rather than the endpoint: this is a fixture for tests
    whose subject is something else. The tests whose subject *is* verification
    use the real link, and one of them proves this shortcut agrees with it.
    """

    def confirm(email: str) -> None:
        with connection(settings) as conn, conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET email_verified_at = now() WHERE lower(email) = %s",
                (email.strip().lower(),),
            )
            conn.commit()

    return confirm
