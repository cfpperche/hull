"""Forgotten password: the one credential that arrives unauthenticated.

The token never comes back in a response — it goes out by mail — so these tests
capture the mail the same way a user's inbox would and pull the link out of it.
That also keeps the link's shape under test: a query string would put the token
in every access log between here and the browser.
"""

from __future__ import annotations

import psycopg
import pytest
from fastapi.testclient import TestClient

from hull_fastapi.api import create_app
from hull_fastapi.db import connection


@pytest.fixture
def outbox(monkeypatch) -> list[dict[str, str]]:
    sent: list[dict[str, str]] = []

    def capture(settings, *, to: str, subject: str, text: str, html: str | None = None) -> str:
        sent.append({"to": to, "subject": subject, "text": text, "html": html or ""})
        return "sent"

    monkeypatch.setattr("hull_fastapi.api.send_mail", capture)
    return sent


def _signup(client, unique: str, tag: str = "r") -> str:
    email = f"{tag}{unique}@hull.test"
    res = client.post(
        "/v1/auth/signup",
        json={"email": email, "password": "demodemo1"},
    )
    assert res.status_code == 201, res.text
    return email


def _link_token(outbox: list[dict[str, str]]) -> str:
    assert outbox, "no mail was sent"
    text = outbox[-1]["text"]
    marker = "/reset#"
    assert marker in text, text
    return text.split(marker, 1)[1].split()[0]


def test_forgot_sends_a_single_use_link_that_sets_a_new_password(
    client, settings, unique: str, outbox
) -> None:
    email = _signup(client, unique)

    assert client.post("/v1/auth/forgot", json={"email": email}).status_code == 204
    token = _link_token(outbox)

    fresh = TestClient(create_app(settings))
    res = fresh.post("/v1/auth/reset", json={"token": token, "password": "brandnew123"})
    assert res.status_code == 204, res.text

    # The old password is gone and the new one works.
    assert (
        fresh.post("/v1/auth/signin", json={"email": email, "password": "demodemo1"}).status_code
        == 401
    )
    assert (
        fresh.post("/v1/auth/signin", json={"email": email, "password": "brandnew123"}).status_code
        == 200
    )


def test_forgot_answers_the_same_for_an_address_nobody_holds(client, unique: str, outbox) -> None:
    """Otherwise the endpoint is a free membership oracle."""
    res = client.post("/v1/auth/forgot", json={"email": f"nobody{unique}@hull.test"})
    assert res.status_code == 204
    assert outbox == []


def test_the_token_rides_in_the_fragment(client, unique: str, outbox) -> None:
    """A fragment is never sent to a server: not in access logs, not in Referer."""
    email = _signup(client, unique)
    client.post("/v1/auth/forgot", json={"email": email})
    text = outbox[-1]["text"]
    assert "/reset#" in text
    assert "?token=" not in text


def test_the_link_works_once(client, settings, unique: str, outbox) -> None:
    email = _signup(client, unique)
    client.post("/v1/auth/forgot", json={"email": email})
    token = _link_token(outbox)

    first = TestClient(create_app(settings))
    assert (
        first.post("/v1/auth/reset", json={"token": token, "password": "brandnew123"}).status_code
        == 204
    )

    replay = TestClient(create_app(settings))
    res = replay.post("/v1/auth/reset", json={"token": token, "password": "otherpass123"})
    assert res.status_code == 401, res.text
    assert res.json()["reason_code"] == "unauthenticated"


def test_an_expired_link_is_refused(client, settings, unique: str, outbox) -> None:
    email = _signup(client, unique)
    client.post("/v1/auth/forgot", json={"email": email})
    token = _link_token(outbox)
    with psycopg.connect(settings.database_url) as conn, conn.cursor() as cur:
        cur.execute("UPDATE password_resets SET expires_at = now() - interval '1 second'")
        conn.commit()
    fresh = TestClient(create_app(settings))
    assert (
        fresh.post("/v1/auth/reset", json={"token": token, "password": "brandnew123"}).status_code
        == 401
    )


def test_a_garbage_token_is_refused(client, settings, unique: str) -> None:
    fresh = TestClient(create_app(settings))
    res = fresh.post("/v1/auth/reset", json={"token": "not-a-token", "password": "brandnew123"})
    assert res.status_code == 401


def test_reset_ends_every_session(client, settings, unique: str, outbox) -> None:
    """A reset is what someone does when they think an attacker holds a session."""
    email = _signup(client, unique)
    assert client.get("/v1/me").status_code == 200  # signup signed this client in

    client.post("/v1/auth/forgot", json={"email": email})
    token = _link_token(outbox)
    fresh = TestClient(create_app(settings))
    assert (
        fresh.post("/v1/auth/reset", json={"token": token, "password": "brandnew123"}).status_code
        == 204
    )

    assert client.get("/v1/me").status_code == 401


def test_asking_twice_retires_the_older_link(client, settings, unique: str, outbox) -> None:
    email = _signup(client, unique)
    client.post("/v1/auth/forgot", json={"email": email})
    first_token = _link_token(outbox)
    client.post("/v1/auth/forgot", json={"email": email})
    second_token = _link_token(outbox)
    assert first_token != second_token

    fresh = TestClient(create_app(settings))
    assert (
        fresh.post(
            "/v1/auth/reset", json={"token": second_token, "password": "brandnew123"}
        ).status_code
        == 204
    )
    # The one still sitting in the older mail no longer works.
    other = TestClient(create_app(settings))
    assert (
        other.post(
            "/v1/auth/reset", json={"token": first_token, "password": "otherpass123"}
        ).status_code
        == 401
    )


def test_a_short_password_is_refused_and_the_link_survives(
    client, settings, unique: str, outbox
) -> None:
    """A rejected attempt must not burn the token, or a typo locks the user out."""
    email = _signup(client, unique)
    client.post("/v1/auth/forgot", json={"email": email})
    token = _link_token(outbox)

    fresh = TestClient(create_app(settings))
    assert (
        fresh.post("/v1/auth/reset", json={"token": token, "password": "short"}).status_code == 422
    )

    assert (
        fresh.post("/v1/auth/reset", json={"token": token, "password": "brandnew123"}).status_code
        == 204
    )


def test_the_reset_is_recorded(client, settings, unique: str, outbox) -> None:
    email = _signup(client, unique)
    client.post("/v1/auth/forgot", json={"email": email})
    with connection(settings) as conn, conn.cursor() as cur:
        cur.execute("SELECT count(*) AS n FROM install_events WHERE event = 'auth.forgot'")
        assert cur.fetchone()["n"] >= 1
