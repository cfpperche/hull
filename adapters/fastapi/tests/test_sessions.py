"""Seeing where you are signed in, and ending it.

Sessions have been per-device since PR #5 and nothing surfaced them. These tests
cover the two things that make a list like this worth having: it must name the
row you are reading it from, and revoking must be scoped to the person asking —
the id is in the URL, so ownership is the only thing standing between one user
and everybody else's sessions.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from hull_fastapi.accounts import _device_parts
from hull_fastapi.api import create_app
from hull_fastapi.db import connection

PASSWORD = "demodemo1"


@pytest.fixture
def outbox(monkeypatch) -> list[dict[str, str]]:
    sent: list[dict[str, str]] = []

    def capture(settings, *, to: str, subject: str, text: str, html: str | None = None) -> str:
        sent.append({"to": to, "subject": subject, "text": text, "html": html or ""})
        return "sent"

    monkeypatch.setattr("hull_fastapi.api.send_mail", capture)
    return sent


def _signup(client, unique: str, tag: str = "s") -> str:
    email = f"{tag}{unique}@hull.test"
    res = client.post(
        "/v1/auth/signup",
        json={"email": email, "password": PASSWORD},
    )
    assert res.status_code == 201, res.text
    return email


def _sessions(client) -> list[dict]:
    res = client.get("/v1/me/sessions")
    assert res.status_code == 200, res.text
    return res.json()["sessions"]


def _sign_in_elsewhere(settings, email: str, agent: str) -> TestClient:
    """A second client is a second device — separate cookie jar, separate row."""
    other = TestClient(create_app(settings))
    res = other.post(
        "/v1/auth/signin",
        json={"email": email, "password": PASSWORD},
        headers={"user-agent": agent},
    )
    assert res.status_code == 200, res.text
    return other


def test_a_fresh_account_has_one_session_and_it_is_this_one(client, unique: str, outbox) -> None:
    _signup(client, unique)
    rows = _sessions(client)
    assert len(rows) == 1
    assert rows[0]["current"] is True
    assert rows[0]["support"] is False


def test_signing_in_elsewhere_adds_a_row_and_only_one_is_current(
    client, settings, unique: str, outbox
) -> None:
    email = _signup(client, unique)
    other = _sign_in_elsewhere(settings, email, "Mozilla/5.0 (iPhone) Safari/605.1")

    here = _sessions(client)
    assert len(here) == 2
    assert [r["current"] for r in here].count(True) == 1
    # Each client sees itself as current. That is the whole point of the flag —
    # it is a property of the request, not of the row.
    there = _sessions(other)
    assert {r["id"] for r in there} == {r["id"] for r in here}
    current_here = next(r["id"] for r in here if r["current"])
    current_there = next(r["id"] for r in there if r["current"])
    assert current_here != current_there


def test_the_device_label_comes_from_the_user_agent(client, settings, unique: str, outbox) -> None:
    """Two names, never a phrase.

    "Chrome on Windows" reads as one string and is really two proper nouns
    joined by an English word. The server answers with the nouns; the word
    between them belongs to whichever catalog the reader is using. → ADR-0016
    """
    email = _signup(client, unique)
    _sign_in_elsewhere(settings, email, "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36")
    rows = _sessions(client)
    assert ("Chrome", "Windows") in [(r["browser"], r["system"]) for r in rows]
    # Nothing in the payload is a sentence somebody would have to translate.
    for row in rows:
        for value in (row["browser"], row["system"]):
            assert value is None or " " not in value, f"{value!r} is a phrase, not a name"


def test_an_unreadable_user_agent_answers_with_nothing(
    client, settings, unique: str, outbox
) -> None:
    """Not "Unknown device" — that is a sentence, and the server has no catalog.
    Null is the honest answer, and the screen decides what to call it."""
    email = _signup(client, unique)
    _sign_in_elsewhere(settings, email, "")
    rows = _sessions(client)
    assert any(r["browser"] is None and r["system"] is None for r in rows)


def test_revoking_a_session_ends_it(client, settings, unique: str, outbox) -> None:
    email = _signup(client, unique)
    other = _sign_in_elsewhere(settings, email, "Mozilla/5.0 (Macintosh; Mac OS X) Firefox/121.0")
    target = next(r["id"] for r in _sessions(client) if not r["current"])

    assert client.delete(f"/v1/me/sessions/{target}").status_code == 204
    assert len(_sessions(client)) == 1
    # The revoked client is out, not merely absent from a list.
    assert other.get("/v1/me").status_code == 401


def test_one_user_cannot_revoke_another_users_session(
    client, settings, unique: str, outbox
) -> None:
    _signup(client, unique, tag="v")
    victim_session = _sessions(client)[0]["id"]

    # A separate client, so the victim stays signed in throughout. Signing them
    # out to make room would delete the row and prove nothing.
    attacker = TestClient(create_app(settings))
    _signup(attacker, unique, tag="a")

    res = attacker.delete(f"/v1/me/sessions/{victim_session}")
    assert res.status_code == 404
    assert res.json()["reason_code"] == "not_found"

    # And it really is still alive: 404 must mean "not yours", not "deleted and
    # then denied".
    assert client.get("/v1/me").status_code == 200
    assert victim_session in {r["id"] for r in _sessions(client)}


def test_an_unknown_id_is_a_404_not_a_500(client, unique: str, outbox) -> None:
    _signup(client, unique)
    res = client.delete("/v1/me/sessions/00000000-0000-0000-0000-000000000000")
    assert res.status_code == 404


def test_a_malformed_id_is_refused_by_the_route(client, unique: str, outbox) -> None:
    _signup(client, unique)
    assert client.delete("/v1/me/sessions/not-a-uuid").status_code == 422


def test_revoking_your_own_session_signs_you_out(client, unique: str, outbox) -> None:
    _signup(client, unique)
    mine = _sessions(client)[0]["id"]
    assert client.delete(f"/v1/me/sessions/{mine}").status_code == 204
    assert client.get("/v1/me").status_code == 401


def test_signing_out_everywhere_else_keeps_this_one(client, settings, unique: str, outbox) -> None:
    email = _signup(client, unique)
    a = _sign_in_elsewhere(settings, email, "device-a")
    b = _sign_in_elsewhere(settings, email, "device-b")
    assert len(_sessions(client)) == 3

    assert client.delete("/v1/me/sessions").status_code == 204

    rows = _sessions(client)
    assert len(rows) == 1
    assert rows[0]["current"] is True
    assert a.get("/v1/me").status_code == 401
    assert b.get("/v1/me").status_code == 401


def test_a_signed_out_caller_sees_nothing(client, unique: str, outbox) -> None:
    _signup(client, unique)
    client.post("/v1/auth/signout")
    assert client.get("/v1/me/sessions").status_code == 401
    assert client.delete("/v1/me/sessions").status_code == 401


def test_an_expired_session_is_not_listed(client, settings, unique: str, outbox) -> None:
    email = _signup(client, unique)
    _sign_in_elsewhere(settings, email, "old-laptop")
    stale = next(r["id"] for r in _sessions(client) if not r["current"])
    with connection(settings) as conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE sessions SET expires_at = now() - interval '1 day' WHERE id = %s", (stale,)
        )
        conn.commit()
    assert stale not in {r["id"] for r in _sessions(client)}


def test_last_seen_is_stamped_on_use_but_not_on_every_request(
    client, settings, unique: str, outbox
) -> None:
    """The write is guarded by SEEN_GRANULARITY, so a page firing five requests
    writes once. Push the stamp into the past and watch exactly one request move
    it; a second request must leave it where the first put it."""
    _signup(client, unique)
    session_id = _sessions(client)[0]["id"]
    with connection(settings) as conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE sessions SET last_seen_at = now() - interval '1 hour' WHERE id = %s",
            (session_id,),
        )
        conn.commit()

    client.get("/v1/me")
    with connection(settings) as conn, conn.cursor() as cur:
        cur.execute("SELECT last_seen_at FROM sessions WHERE id = %s", (session_id,))
        after_first = cur.fetchone()["last_seen_at"]

    client.get("/v1/me")
    with connection(settings) as conn, conn.cursor() as cur:
        cur.execute("SELECT last_seen_at FROM sessions WHERE id = %s", (session_id,))
        after_second = cur.fetchone()["last_seen_at"]

    assert after_first > after_second - __import__("datetime").timedelta(seconds=1)
    assert after_first == after_second


def test_a_support_session_is_named_as_one(client, settings, unique: str, outbox) -> None:
    """It belongs to the operator, so it belongs in the operator's list — but as
    an unexplained extra row it would read like a break-in."""
    # Mint the operator rather than borrowing the seeded one. admin@hull.test
    # only exists when HULL_SEED_DEMO=1, which CI does not set — the first
    # version of this test passed here against a row an earlier run had left
    # behind, and failed on a clean runner.
    admin_email = f"adm{unique}@hull.test"
    admin = TestClient(create_app(settings))
    assert (
        admin.post(
            "/v1/auth/signup",
            json={"email": admin_email, "password": PASSWORD},
        ).status_code
        == 201
    )
    with connection(settings) as conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE users SET platform_role = 'platform_admin' WHERE lower(email) = %s",
            (admin_email,),
        )
        conn.commit()
    # Sign in again so the session carries the promoted role.
    assert (
        admin.post("/v1/auth/signin", json={"email": admin_email, "password": PASSWORD}).status_code
        == 200
    )
    # Diff against what is already there: signup and sign-in have each left a
    # session, and this test is about the one the hand-off adds.
    before = {r["id"] for r in _sessions(admin)}

    customer_email = _signup(client, unique)
    # The customer has to be past the wall to own a workspace; without this the
    # org is never created and the hand-off has nothing to impersonate. The
    # subject here is the support session, not the gate.
    with connection(settings) as conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE users SET email_verified_at = now() WHERE lower(email) = %s",
            (customer_email,),
        )
        conn.commit()
    created = client.post("/v1/orgs", json={"name": f"Co {unique}"})
    assert created.status_code == 201, created.text
    org_id = client.get("/v1/me").json()["org"]["id"]

    handoff = admin.post("/v1/admin/support", json={"org_id": org_id}).json()["handoff"]
    viewer = TestClient(create_app(settings))
    assert viewer.post("/v1/session/handoff", json={"token": handoff}).status_code == 200

    rows = _sessions(admin)
    new = [r for r in rows if r["id"] not in before]
    assert len(new) == 1
    assert new[0]["support"] is True
    assert new[0]["current"] is False
    # The operator's console session is not marked support, or the flag would
    # mean nothing.
    assert next(r for r in rows if r["current"])["support"] is False


@pytest.mark.parametrize(
    "ua,expected",
    [
        ("Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0 Safari/537.36", ("Chrome", "Windows")),
        (
            "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0 Safari/537.36 Edg/120.0",
            ("Edge", "Windows"),
        ),
        ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Firefox/121.0", ("Firefox", "macOS")),
        (
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Version/17.0 Safari/605.1.15",
            ("Safari", "iPhone"),
        ),
        (
            "Mozilla/5.0 (X11; Linux x86_64) Chrome/119.0 Safari/537.36 OPR/105.0",
            ("Opera", "Linux"),
        ),
        ("Mozilla/5.0 (Linux; Android 14) Chrome/120.0 Safari/537.36", ("Chrome", "Android")),
        # curl names neither, and the answer is nothing rather than a sentence:
        # "Unknown device" is English, and this module has no catalog.
        ("curl/8.4.0", (None, None)),
        ("", (None, None)),
        (None, (None, None)),
    ],
)
def test_the_device_label_is_dumb_but_right_about_the_common_cases(ua, expected) -> None:
    # Every one of these strings claims to be something it is not — that is what
    # User-Agent is. The order of the checks is the whole implementation.
    assert _device_parts(ua) == expected
