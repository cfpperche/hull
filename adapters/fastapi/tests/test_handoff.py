"""Support hand-off: the bridge that replaces the apex-scoped cookie."""

from __future__ import annotations

import psycopg
import pytest

from hull_fastapi.api import create_app
from hull_fastapi.db import connection
from fastapi.testclient import TestClient


def _admin(client, settings, unique: str) -> str:
    """Sign up, promote to platform_admin, return the org id of a second user."""
    client.post(
        "/v1/auth/signup",
        json={"username": f"a{unique}", "email": f"a{unique}@hull.test", "password": "demodemo1"},
    )
    with connection(settings) as conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE users SET platform_role = 'platform_admin' WHERE lower(email) = %s",
            (f"a{unique}@hull.test",),
        )
        conn.commit()
    return f"a{unique}@hull.test"


def _customer_org(settings, unique: str) -> str:
    other = TestClient(create_app(settings))
    other.post(
        "/v1/auth/signup",
        json={"username": f"c{unique}", "email": f"c{unique}@hull.test", "password": "demodemo1"},
    )
    res = other.post("/v1/orgs", json={"name": f"Acme {unique}"})
    assert res.status_code == 201, res.text
    return res.json()["org"]["id"]


@pytest.fixture
def impersonation(client, settings, unique: str):
    org_id = _customer_org(settings, unique)
    _admin(client, settings, unique)
    # Re-sign-in so the session reflects the promoted role.
    client.post("/v1/auth/signin", json={"email": f"a{unique}@hull.test", "password": "demodemo1"})
    return org_id


def test_support_start_returns_a_token_and_leaves_the_session_alone(client, impersonation) -> None:
    """Impersonation lives on the customer surface, not on the admin console."""
    res = client.post("/v1/admin/support", json={"org_id": impersonation})
    assert res.status_code == 200, res.text
    assert res.json()["handoff"]
    # The admin's own session is untouched — no acting org on the console.
    assert client.get("/v1/me").json()["acting"] is None


def test_handoff_creates_an_impersonating_session(client, settings, impersonation) -> None:
    token = client.post("/v1/admin/support", json={"org_id": impersonation}).json()["handoff"]

    surface = TestClient(create_app(settings))  # a browser with no cookie for this host
    assert surface.get("/v1/me").status_code == 401

    res = surface.post("/v1/session/handoff", json={"token": token})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["acting"] is not None
    assert body["acting"]["org"]["id"] == impersonation
    assert body["org"]["id"] == impersonation
    assert surface.get("/v1/me").status_code == 200


def test_handoff_token_is_single_use(client, settings, impersonation) -> None:
    token = client.post("/v1/admin/support", json={"org_id": impersonation}).json()["handoff"]
    first = TestClient(create_app(settings))
    assert first.post("/v1/session/handoff", json={"token": token}).status_code == 200

    replay = TestClient(create_app(settings))
    res = replay.post("/v1/session/handoff", json={"token": token})
    assert res.status_code == 401, res.text
    assert res.json()["reason_code"] == "unauthenticated"


def test_expired_handoff_is_refused(client, settings, impersonation) -> None:
    token = client.post("/v1/admin/support", json={"org_id": impersonation}).json()["handoff"]
    with psycopg.connect(settings.database_url) as conn, conn.cursor() as cur:
        cur.execute("UPDATE support_handoffs SET expires_at = now() - interval '1 second'")
        conn.commit()
    surface = TestClient(create_app(settings))
    assert surface.post("/v1/session/handoff", json={"token": token}).status_code == 401


def test_garbage_token_is_refused(client, settings, impersonation) -> None:
    surface = TestClient(create_app(settings))
    assert surface.post("/v1/session/handoff", json={"token": "not-a-token"}).status_code == 401


def test_role_is_rechecked_at_redemption(client, settings, unique: str, impersonation) -> None:
    """The operator may be demoted between minting the token and using it."""
    token = client.post("/v1/admin/support", json={"org_id": impersonation}).json()["handoff"]
    with connection(settings) as conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE users SET platform_role = NULL WHERE lower(email) = %s",
            (f"a{unique}@hull.test",),
        )
        conn.commit()
    surface = TestClient(create_app(settings))
    res = surface.post("/v1/session/handoff", json={"token": token})
    assert res.status_code == 403, res.text
    assert res.json()["reason_code"] == "forbidden"


def test_non_admin_cannot_mint_a_handoff(client, settings, unique: str) -> None:
    org_id = _customer_org(settings, unique)
    client.post(
        "/v1/auth/signup",
        json={"username": f"n{unique}", "email": f"n{unique}@hull.test", "password": "demodemo1"},
    )
    res = client.post("/v1/admin/support", json={"org_id": org_id})
    assert res.status_code == 403


def test_stop_ends_the_impersonating_session(client, settings, impersonation) -> None:
    token = client.post("/v1/admin/support", json={"org_id": impersonation}).json()["handoff"]
    surface = TestClient(create_app(settings))
    surface.post("/v1/session/handoff", json={"token": token})
    assert surface.get("/v1/me").status_code == 200

    assert surface.delete("/v1/admin/support").status_code == 204
    # The session is gone, not merely un-acted.
    assert surface.get("/v1/me").status_code == 401


def test_cookie_is_host_scoped(client, unique: str) -> None:
    """No Domain attribute: the apex scope handed the token to mail./s3./rustfs."""
    res = client.post(
        "/v1/auth/signup",
        json={"username": f"h{unique}", "email": f"h{unique}@hull.test", "password": "demodemo1"},
    )
    assert res.status_code == 201
    set_cookie = res.headers["set-cookie"]
    assert "domain=" not in set_cookie.lower(), set_cookie
