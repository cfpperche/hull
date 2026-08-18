"""Which language an account reads.

Two halves that have to be checked separately. `negotiate` is pure header
parsing and is asserted against the same cases as its TypeScript twin in
`packages/i18n/src/selftest.ts` — the list of locales is generated and shared,
the algorithm is not, so the cases are what keeps the two answering alike. The
rest goes through the API, because the point of the column is that it survives
the round trip.
"""

from __future__ import annotations

import json
import re

import pytest
from fastapi.testclient import TestClient

from hull_fastapi.api import create_app
from hull_fastapi.db import connection
from hull_fastapi.locales import MANIFEST, default_locale, locales, negotiate, resolve


def _signup(client, unique: str, *, headers: dict[str, str] | None = None) -> str:
    email = f"loc{unique}@hull.test"
    res = client.post(
        "/v1/auth/signup",
        json={"email": email, "password": "demodemo1"},
        headers=headers or {},
    )
    assert res.status_code == 201, res.text
    return email


# --- the generated list ----------------------------------------------------


def test_the_locale_list_is_generated_not_typed_here() -> None:
    """If this file were hand-maintained it would drift from packages/i18n in
    the direction nobody notices: a locale the frontend offers and the API
    silently refuses."""
    raw = json.loads(MANIFEST.read_text(encoding="utf-8"))
    assert raw["locales"] == list(locales())
    assert raw["default"] == default_locale()
    assert default_locale() in locales()
    # Every locale needs a name to put in a picker, in its own language.
    assert set(raw["names"]) == set(raw["locales"])


# --- negotiate: the same cases as the TypeScript selftest -------------------


@pytest.mark.parametrize(
    ("header", "want"),
    [
        ("pt-BR,pt;q=0.9,en;q=0.8", "pt-BR"),
        ("en-US,en;q=0.9", "en"),
        # The only Portuguese we have beats English for a Portuguese reader.
        ("pt-PT", "pt-BR"),
        ("pt-br", "pt-BR"),
        ("de,fr;q=0.9", "en"),
        # A wildcard means "anything", which is what the fallback already is.
        ("*", "en"),
        # q=0 is a refusal, not a preference.
        ("pt-BR;q=0, en", "en"),
        ("", "en"),
        (None, "en"),
        # Malformed weight: a header we cannot read is not a preference.
        ("pt-BR;q=banana, en", "en"),
    ],
)
def test_negotiate(header: str | None, want: str) -> None:
    assert negotiate(header) == want


def test_resolve_falls_back_rather_than_raising() -> None:
    """Refusing a signup because we do not speak somebody's language would be an
    odd way to say "we only have English"."""
    assert resolve("pt-BR") == "pt-BR"
    assert resolve("kl-GL") == default_locale()
    assert resolve(None) == default_locale()
    assert resolve("") == default_locale()


# --- through the API -------------------------------------------------------


def test_signup_takes_the_locale_from_the_header(client, unique: str) -> None:
    _signup(client, unique, headers={"accept-language": "pt-BR,pt;q=0.9"})
    assert client.get("/v1/me").json()["user"]["locale"] == "pt-BR"


def test_signup_without_a_header_is_the_default(client, unique: str) -> None:
    _signup(client, unique)
    assert client.get("/v1/me").json()["user"]["locale"] == default_locale()


def test_a_language_we_do_not_speak_is_the_default(client, unique: str) -> None:
    _signup(client, unique, headers={"accept-language": "kl-GL,kl;q=0.9"})
    assert client.get("/v1/me").json()["user"]["locale"] == default_locale()


def test_the_choice_is_stored_and_survives_a_new_session(client, settings, unique: str) -> None:
    """The stored choice is the top rung of the ladder — it has to beat the
    header on every later request, from any browser."""
    email = _signup(client, unique)
    res = client.patch("/v1/me", json={"locale": "pt-BR"})
    assert res.status_code == 200, res.text
    assert res.json()["user"]["locale"] == "pt-BR"

    other = TestClient(create_app(settings))
    signin = other.post(
        "/v1/auth/signin",
        json={"email": email, "password": "demodemo1"},
        # An English browser. The stored choice still wins.
        headers={"accept-language": "en-US,en;q=0.9"},
    )
    assert signin.status_code == 200, signin.text
    assert signin.json()["user"]["locale"] == "pt-BR"


def test_patching_something_else_leaves_the_locale_alone(client, unique: str) -> None:
    _signup(client, unique, headers={"accept-language": "pt-BR"})
    res = client.patch("/v1/me", json={"name": "Ada"})
    assert res.status_code == 200, res.text
    assert res.json()["user"]["locale"] == "pt-BR"
    assert res.json()["user"]["name"] == "Ada"


def test_a_locale_we_do_not_ship_is_stored_as_the_default(client, unique: str) -> None:
    _signup(client, unique)
    res = client.patch("/v1/me", json={"locale": "kl-GL"})
    assert res.status_code == 200, res.text
    assert res.json()["user"]["locale"] == default_locale()


def test_an_account_predating_the_column_reads_english(client, settings, unique: str) -> None:
    """hull_test is never dropped, so rows written before 007 are still here.
    The column defaults rather than being nullable precisely so this is a value
    and not a fallback carried through every read."""
    _signup(client, unique)
    user_id = client.get("/v1/me").json()["user"]["id"]
    with connection(settings) as conn, conn.cursor() as cur:
        cur.execute("SELECT locale FROM users WHERE id = %s", (user_id,))
        assert cur.fetchone()["locale"] == default_locale()


# --- the mail, which is where the language actually has to travel ------------


@pytest.fixture
def outbox(monkeypatch) -> list[dict[str, str]]:
    sent: list[dict[str, str]] = []

    def capture(settings, *, to: str, subject: str, text: str, html: str | None = None) -> str:
        sent.append({"to": to, "subject": subject, "text": text, "html": html or ""})
        return "sent"

    monkeypatch.setattr("hull_fastapi.api.send_mail", capture)
    return sent


def test_the_welcome_arrives_in_the_language_the_browser_asked_for(
    client, unique: str, outbox
) -> None:
    """The whole reason the locale is read from the header at signup: this mail
    goes out inside that request, before anyone could have chosen anything."""
    _signup(client, unique, headers={"accept-language": "pt-BR,pt;q=0.9"})
    assert len(outbox) == 1
    assert "Bem-vindo" in outbox[0]["subject"]
    assert "Sua conta está pronta" in outbox[0]["text"]
    assert "Your account is ready" not in outbox[0]["text"]


def test_english_is_still_english(client, unique: str, outbox) -> None:
    """The other half of the pair. A t() that returned Portuguese for everything
    would pass the test above."""
    _signup(client, unique, headers={"accept-language": "en-GB,en;q=0.9"})
    assert "Welcome to" in outbox[0]["subject"]
    assert "Your account is ready" in outbox[0]["text"]


def test_a_reset_is_written_in_the_account_language_not_the_requesters(
    client, settings, unique: str, outbox
) -> None:
    """Forgot-password arrives unauthenticated, from any browser. The language
    has to come off the account, which is the reason it is a column at all."""
    email = _signup(client, unique, headers={"accept-language": "pt-BR"})
    outbox.clear()

    # A different, English browser asking for the reset.
    anon = TestClient(create_app(settings))
    res = anon.post(
        "/v1/auth/forgot",
        json={"email": email},
        headers={"accept-language": "en-US,en;q=0.9"},
    )
    assert res.status_code == 204, res.text
    assert len(outbox) == 1
    assert "Redefina sua senha" in outbox[0]["subject"]
    assert "Redefina sua senha" in outbox[0]["text"]
    assert "Reset your password" not in outbox[0]["text"]


def test_the_change_notice_reaches_the_old_address_in_its_own_language(
    client, unique: str, outbox
) -> None:
    """Two mails, two addresses, one account — so one language for both.

    Asserted with phrases that share no substring across the two languages.
    "Confirm" is a substring of "Confirme", so the obvious negative assertion
    here passes whatever language is sent — the same trap that once made an
    email-change spec in `e2e/` pass with a planted violation.
    """
    old = _signup(client, unique, headers={"accept-language": "pt-BR"})
    new = f"novo{unique}@hull.test"
    outbox.clear()

    res = client.post("/v1/me/email", json={"password": "demodemo1", "email": new})
    assert res.status_code == 204, res.text
    assert len(outbox) == 2

    confirm = next(m for m in outbox if m["to"] == new)
    assert "Confirme seu novo e-mail" in confirm["text"]
    assert "your new email" not in confirm["text"].lower()

    # The address losing the account, which is the one that has to understand a
    # warning. It reads the account's language because it *is* the account.
    notice = next(m for m in outbox if m["to"] == old)
    assert "está sendo alterado" in notice["text"]
    assert "is being changed" not in notice["text"].lower()
    assert "troque sua senha agora" in notice["text"].lower()


def test_no_message_ships_a_hole_in_either_language(client, unique: str, outbox) -> None:
    """The failure mode that reaches an inbox looking like a defect: `{{brand}}`
    or `{oldEmail}` delivered literally. Asserted on the message the API actually
    sent, not on the template it was built from."""
    _signup(client, unique, headers={"accept-language": "pt-BR"})
    client.post("/v1/me/email", json={"password": "demodemo1", "email": f"h{unique}@hull.test"})
    assert outbox
    for mail in outbox:
        for half in ("subject", "text", "html"):
            assert "{{" not in mail[half], f"{mail['subject']}: {half} kept a sender hole"
            assert not re.search(r"(?<!\{)\{[a-zA-Z][a-zA-Z0-9]*\}(?!\})", mail[half]), (
                f"{mail['subject']}: {half} kept a catalog hole"
            )
