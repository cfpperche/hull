"""Email verification.

The address was collected at signup and never confirmed, which stopped being
cosmetic the day password reset shipped: recovery is handed to whatever was
typed in that box. These tests read the mail the way an inbox would, for the
same reason the reset tests do — the token exists nowhere else.
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

    def capture(settings, *, to: str, subject: str, text: str) -> str:
        sent.append({"to": to, "subject": subject, "text": text})
        return "sent"

    monkeypatch.setattr("hull_fastapi.api.send_mail", capture)
    return sent


def _signup(client, unique: str, tag: str = "v") -> str:
    email = f"{tag}{unique}@hull.test"
    res = client.post(
        "/v1/auth/signup",
        json={"username": f"{tag}{unique}", "email": email, "password": "demodemo1"},
    )
    assert res.status_code == 201, res.text
    return email


def _link_token(outbox: list[dict[str, str]]) -> str:
    assert outbox, "no mail was sent"
    text = outbox[-1]["text"]
    marker = "/verify#"
    assert marker in text, text
    return text.split(marker, 1)[1].split()[0]


def test_signup_is_unverified_and_the_welcome_carries_the_link(client, unique: str, outbox) -> None:
    _signup(client, unique)
    assert client.get("/v1/me").json()["user"]["email_verified"] is False
    # One mail, not two: a welcome and a separate "confirm your address" is the
    # pair people learn to ignore.
    assert len(outbox) == 1
    assert "/verify#" in outbox[0]["text"]
    assert "?token=" not in outbox[0]["text"]


def test_the_link_verifies_the_address(client, settings, unique: str, outbox) -> None:
    _signup(client, unique)
    token = _link_token(outbox)

    # Public on purpose: the link is clicked from a mail client, which carries
    # no session for this host.
    anon = TestClient(create_app(settings))
    assert anon.get("/v1/me").status_code == 401
    assert anon.post("/v1/auth/verify", json={"token": token}).status_code == 204

    assert client.get("/v1/me").json()["user"]["email_verified"] is True


def test_the_link_works_once(client, settings, unique: str, outbox) -> None:
    _signup(client, unique)
    token = _link_token(outbox)
    first = TestClient(create_app(settings))
    assert first.post("/v1/auth/verify", json={"token": token}).status_code == 204

    replay = TestClient(create_app(settings))
    res = replay.post("/v1/auth/verify", json={"token": token})
    assert res.status_code == 401, res.text
    assert res.json()["reason_code"] == "unauthenticated"


def test_an_expired_link_is_refused(client, settings, unique: str, outbox) -> None:
    _signup(client, unique)
    token = _link_token(outbox)
    with psycopg.connect(settings.database_url) as conn, conn.cursor() as cur:
        cur.execute("UPDATE email_verifications SET expires_at = now() - interval '1 second'")
        conn.commit()
    anon = TestClient(create_app(settings))
    assert anon.post("/v1/auth/verify", json={"token": token}).status_code == 401
    assert client.get("/v1/me").json()["user"]["email_verified"] is False


def test_a_garbage_token_is_refused(client, settings, unique: str) -> None:
    anon = TestClient(create_app(settings))
    assert anon.post("/v1/auth/verify", json={"token": "not-a-token"}).status_code == 401


def test_resend_mints_a_new_link_and_retires_the_old_one(
    client, settings, unique: str, outbox
) -> None:
    _signup(client, unique)
    first_token = _link_token(outbox)

    assert client.post("/v1/me/verify").status_code == 204
    second_token = _link_token(outbox)
    assert first_token != second_token

    # The one still sitting in the older mail is dead once the newer is used.
    anon = TestClient(create_app(settings))
    assert anon.post("/v1/auth/verify", json={"token": second_token}).status_code == 204
    other = TestClient(create_app(settings))
    assert other.post("/v1/auth/verify", json={"token": first_token}).status_code == 401


def test_resend_on_a_verified_address_sends_nothing(client, settings, unique: str, outbox) -> None:
    """There is no state to change and nothing useful to say about it."""
    _signup(client, unique)
    token = _link_token(outbox)
    TestClient(create_app(settings)).post("/v1/auth/verify", json={"token": token})
    outbox.clear()

    assert client.post("/v1/me/verify").status_code == 204
    assert outbox == []


def test_resend_needs_a_session(client, settings, unique: str) -> None:
    anon = TestClient(create_app(settings))
    assert anon.post("/v1/me/verify").status_code == 401


def test_a_link_does_not_confirm_an_address_that_replaced_it(
    client, settings, unique: str, outbox
) -> None:
    """The token stores the address it was sent to, not just the user.

    Nothing changes an email yet, so this stands in for it directly — but the
    column exists for exactly this, and without the check a stale link would
    rubber-stamp whatever address happened to be on the account when it landed.
    """
    email = _signup(client, unique)
    token = _link_token(outbox)
    with connection(settings) as conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE users SET email = %s WHERE lower(email) = %s",
            (f"moved-{email}", email),
        )
        conn.commit()

    anon = TestClient(create_app(settings))
    # The link is spent either way — it was a real, unexpired token.
    assert anon.post("/v1/auth/verify", json={"token": token}).status_code == 204
    # But the address now on the account was never confirmed by anybody.
    assert client.get("/v1/me").json()["user"]["email_verified"] is False


def test_the_seeded_lab_users_are_verified(client, settings) -> None:
    """A fixture that opens every lab session asking for something impossible —
    click a link in a mailbox that does not exist — is one people learn to skip."""
    with connection(settings) as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT email_verified_at FROM users WHERE lower(email) IN (%s, %s)",
            ("ada@hull.test", "admin@hull.test"),
        )
        rows = cur.fetchall()
    if not rows:
        pytest.skip("lab seed not applied to this database")
    assert all(r["email_verified_at"] is not None for r in rows)
