"""Changing the address you sign in with.

The login identifier was immutable, which made a typo at signup permanent. The
shape here is the same one password reset and verification use — hashed token,
single use, redeemed with `used_at IS NULL` — plus the two things that only
matter for a *change*: the address does not move until the new mailbox answers,
and the old one is told while it can still stop it.
"""

from __future__ import annotations

import pytest

from hull_fastapi.db import connection


@pytest.fixture
def outbox(monkeypatch) -> list[dict[str, str]]:
    sent: list[dict[str, str]] = []

    def capture(settings, *, to: str, subject: str, text: str) -> str:
        sent.append({"to": to, "subject": subject, "text": text})
        return "sent"

    monkeypatch.setattr("hull_fastapi.api.send_mail", capture)
    return sent


PASSWORD = "demodemo1"


def _signup(client, unique: str, tag: str = "c") -> str:
    email = f"{tag}{unique}@hull.test"
    res = client.post(
        "/v1/auth/signup",
        json={"username": f"{tag}{unique}", "email": email, "password": PASSWORD},
    )
    assert res.status_code == 201, res.text
    return email


def _change_token(outbox: list[dict[str, str]]) -> str:
    for mail in reversed(outbox):
        if "/email#" in mail["text"]:
            return mail["text"].split("/email#", 1)[1].split()[0]
    raise AssertionError(f"no change link was mailed: {outbox}")


def _to(outbox: list[dict[str, str]], address: str) -> list[dict[str, str]]:
    return [m for m in outbox if m["to"] == address]


def test_asking_changes_nothing_and_mails_both_addresses(client, unique: str, outbox) -> None:
    old = _signup(client, unique)
    new = f"new{unique}@hull.test"
    outbox.clear()

    res = client.post("/v1/me/email", json={"password": PASSWORD, "email": new})
    assert res.status_code == 204, res.text

    # The account has not moved. This is the property the whole design rests on:
    # a link sitting unread in a mailbox must not cost anyone their sign-in.
    assert client.get("/v1/me").json()["user"]["email"] == old

    assert len(_to(outbox, new)) == 1
    assert "/email#" in _to(outbox, new)[0]["text"]
    assert "?token=" not in _to(outbox, new)[0]["text"]
    # And the address losing the account hears about it now, not afterwards.
    notice = _to(outbox, old)
    assert len(notice) == 1
    assert new in notice[0]["text"]
    assert "change your password" in notice[0]["text"].lower()


def test_the_link_moves_the_address_and_marks_it_verified(client, unique: str, outbox) -> None:
    old = _signup(client, unique)
    new = f"new{unique}@hull.test"
    client.post("/v1/me/email", json={"password": PASSWORD, "email": new})
    token = _change_token(outbox)
    outbox.clear()

    assert client.post("/v1/auth/email", json={"token": token}).status_code == 204

    me = client.get("/v1/me").json()["user"]
    assert me["email"] == new
    # Redeeming this link is the same proof /v1/auth/verify asks for, so it would
    # be theatre to ask again.
    assert me["email_verified"] is True
    # The old address gets the last word: an account it can no longer reach.
    assert len(_to(outbox, old)) == 1
    assert new in _to(outbox, old)[0]["text"]


def test_the_new_address_signs_in_and_the_old_one_stops(client, unique: str, outbox) -> None:
    old = _signup(client, unique)
    new = f"new{unique}@hull.test"
    client.post("/v1/me/email", json={"password": PASSWORD, "email": new})
    client.post("/v1/auth/email", json={"token": _change_token(outbox)})
    client.post("/v1/auth/signout")

    assert (
        client.post("/v1/auth/signin", json={"email": old, "password": PASSWORD}).status_code == 401
    )
    assert (
        client.post("/v1/auth/signin", json={"email": new, "password": PASSWORD}).status_code == 200
    )


def test_the_session_survives_the_change(client, unique: str, outbox) -> None:
    # Not an accident. A reset kills sessions because it is what someone does
    # after losing control; this is a deliberate edit, and ending the session
    # would sign the person out of the laptop because they finished on a phone.
    _signup(client, unique)
    new = f"new{unique}@hull.test"
    client.post("/v1/me/email", json={"password": PASSWORD, "email": new})
    client.post("/v1/auth/email", json={"token": _change_token(outbox)})
    assert client.get("/v1/me").status_code == 200


def test_the_wrong_password_mails_nobody(client, unique: str, outbox) -> None:
    _signup(client, unique)
    outbox.clear()
    res = client.post(
        "/v1/me/email", json={"password": "not-the-password", "email": f"new{unique}@hull.test"}
    )
    assert res.status_code == 401
    # The check is what stops a stolen cookie moving the account. If it fired
    # after the mail, the address would still be spammed by anyone holding one.
    assert outbox == []


def test_a_signed_out_caller_cannot_ask(client, unique: str, outbox) -> None:
    _signup(client, unique)
    client.post("/v1/auth/signout")
    outbox.clear()
    res = client.post("/v1/me/email", json={"password": PASSWORD, "email": f"x{unique}@hull.test"})
    assert res.status_code == 401
    assert outbox == []


def test_an_address_somebody_else_holds_is_refused(client, unique: str, outbox) -> None:
    taken = _signup(client, unique, tag="a")
    client.post("/v1/auth/signout")
    _signup(client, unique, tag="b")
    outbox.clear()

    res = client.post("/v1/me/email", json={"password": PASSWORD, "email": taken})
    assert res.status_code == 409
    assert res.json()["reason_code"] == "email_taken"
    # Nothing is mailed to an address the caller does not own.
    assert outbox == []


def test_your_own_address_is_refused(client, unique: str, outbox) -> None:
    mine = _signup(client, unique)
    outbox.clear()
    res = client.post("/v1/me/email", json={"password": PASSWORD, "email": mine.upper()})
    assert res.status_code == 422
    assert outbox == []


def test_a_malformed_address_is_refused(client, unique: str, outbox) -> None:
    _signup(client, unique)
    outbox.clear()
    assert (
        client.post("/v1/me/email", json={"password": PASSWORD, "email": "nope"}).status_code == 422
    )
    assert outbox == []


def test_the_link_works_once(client, unique: str, outbox) -> None:
    _signup(client, unique)
    new = f"new{unique}@hull.test"
    client.post("/v1/me/email", json={"password": PASSWORD, "email": new})
    token = _change_token(outbox)
    assert client.post("/v1/auth/email", json={"token": token}).status_code == 204
    assert client.post("/v1/auth/email", json={"token": token}).status_code == 401


def test_an_unknown_or_empty_token_is_refused(client, unique: str) -> None:
    assert client.post("/v1/auth/email", json={"token": "nonsense"}).status_code == 401
    assert client.post("/v1/auth/email", json={"token": ""}).status_code == 401


def test_an_expired_link_is_refused(client, settings, unique: str, outbox) -> None:
    _signup(client, unique)
    new = f"new{unique}@hull.test"
    client.post("/v1/me/email", json={"password": PASSWORD, "email": new})
    token = _change_token(outbox)
    with connection(settings) as conn, conn.cursor() as cur:
        cur.execute("UPDATE email_changes SET expires_at = now() - interval '1 minute'")
        conn.commit()
    assert client.post("/v1/auth/email", json={"token": token}).status_code == 401


def test_only_the_first_of_two_pending_links_works(client, unique: str, outbox) -> None:
    _signup(client, unique)
    first = f"one{unique}@hull.test"
    second = f"two{unique}@hull.test"
    client.post("/v1/me/email", json={"password": PASSWORD, "email": first})
    first_token = _change_token(outbox)
    outbox.clear()
    client.post("/v1/me/email", json={"password": PASSWORD, "email": second})
    second_token = _change_token(outbox)

    assert client.post("/v1/auth/email", json={"token": second_token}).status_code == 204
    # The abandoned one dies with it, so a stale link cannot walk the address
    # back later.
    assert client.post("/v1/auth/email", json={"token": first_token}).status_code == 401
    assert client.get("/v1/me").json()["user"]["email"] == second


def test_changing_the_password_cancels_a_pending_change(client, unique: str, outbox) -> None:
    """The notice mail says "if this was not you, change your password". This is
    the test that makes that sentence true rather than reassuring."""
    old = _signup(client, unique)
    client.post("/v1/me/email", json={"password": PASSWORD, "email": f"new{unique}@hull.test"})
    token = _change_token(outbox)

    assert (
        client.post(
            "/v1/me/password", json={"current": PASSWORD, "password": "newpass123"}
        ).status_code
        == 204
    )
    assert client.post("/v1/auth/email", json={"token": token}).status_code == 401
    assert client.get("/v1/me").json()["user"]["email"] == old


def test_resetting_the_password_cancels_a_pending_change(client, unique: str, outbox) -> None:
    old = _signup(client, unique)
    client.post("/v1/me/email", json={"password": PASSWORD, "email": f"new{unique}@hull.test"})
    change_token = _change_token(outbox)
    outbox.clear()

    client.post("/v1/auth/forgot", json={"email": old})
    reset_token = outbox[-1]["text"].split("/reset#", 1)[1].split()[0]
    assert (
        client.post(
            "/v1/auth/reset", json={"token": reset_token, "password": "newpass123"}
        ).status_code
        == 204
    )

    assert client.post("/v1/auth/email", json={"token": change_token}).status_code == 401
    assert (
        client.post("/v1/auth/signin", json={"email": old, "password": "newpass123"}).status_code
        == 200
    )


def test_an_address_taken_while_the_link_waited_is_a_conflict(client, unique: str, outbox) -> None:
    _signup(client, unique, tag="b")
    contested = f"race{unique}@hull.test"
    client.post("/v1/me/email", json={"password": PASSWORD, "email": contested})
    token = _change_token(outbox)

    # Somebody signs up with it before the link is opened.
    client.post("/v1/auth/signout")
    res = client.post(
        "/v1/auth/signup",
        json={"username": f"r{unique}", "email": contested, "password": PASSWORD},
    )
    assert res.status_code == 201

    res = client.post("/v1/auth/email", json={"token": token})
    assert res.status_code == 409
    assert res.json()["reason_code"] == "email_taken"


def test_a_verification_link_minted_before_the_change_cannot_stamp_after(
    client, settings, unique: str, outbox
) -> None:
    """Two layers, and the test walks through both.

    The link was sent to the old mailbox. Whoever reads that mailbox is no longer
    the account holder, and must not be able to confirm the address that replaced
    theirs. The change spends the link outright — and if it did not, the address
    stored beside the token is what still refuses it. That column is the reason
    email_verifications carries an address and not only a user.
    """
    _signup(client, unique)
    verify_token = outbox[-1]["text"].split("/verify#", 1)[1].split()[0]

    new = f"new{unique}@hull.test"
    client.post("/v1/me/email", json={"password": PASSWORD, "email": new})
    client.post("/v1/auth/email", json={"token": _change_token(outbox)})

    # First layer: spent along with the change, so it never reaches the guard.
    assert client.post("/v1/auth/verify", json={"token": verify_token}).status_code == 401
    assert client.get("/v1/me").json()["user"]["email"] == new

    # Second layer, reached by un-spending the row and clearing the stamp the
    # change left. The link is live again and still must not confirm anything —
    # it names an address this account no longer holds.
    with connection(settings) as conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE email_verifications SET used_at = NULL WHERE user_id ="
            " (SELECT id FROM users WHERE lower(email) = %s)",
            (new,),
        )
        cur.execute("UPDATE users SET email_verified_at = NULL WHERE lower(email) = %s", (new,))
        conn.commit()
    assert client.post("/v1/auth/verify", json={"token": verify_token}).status_code == 204
    assert client.get("/v1/me").json()["user"]["email_verified"] is False


def test_the_row_dies_with_the_account(client, settings, unique: str, outbox) -> None:
    _signup(client, unique)
    client.post("/v1/me/email", json={"password": PASSWORD, "email": f"new{unique}@hull.test"})
    token = _change_token(outbox)
    assert client.request("DELETE", "/v1/me", json={"password": PASSWORD}).status_code == 204
    assert client.post("/v1/auth/email", json={"token": token}).status_code == 401


def test_the_token_is_not_stored_in_the_clear(client, settings, unique: str, outbox) -> None:
    _signup(client, unique)
    client.post("/v1/me/email", json={"password": PASSWORD, "email": f"new{unique}@hull.test"})
    token = _change_token(outbox)
    with connection(settings) as conn, conn.cursor() as cur:
        cur.execute("SELECT token_hash FROM email_changes WHERE token_hash = %s", (token,))
        assert cur.fetchone() is None
