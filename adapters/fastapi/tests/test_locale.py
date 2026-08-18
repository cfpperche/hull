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

import pytest
from fastapi.testclient import TestClient

from hull_fastapi.api import create_app
from hull_fastapi.db import connection
from hull_fastapi.locales import MANIFEST, default_locale, locales, negotiate, resolve


def _signup(client, unique: str, *, headers: dict[str, str] | None = None) -> str:
    email = f"loc{unique}@hull.test"
    res = client.post(
        "/v1/auth/signup",
        json={"username": f"loc{unique}", "email": email, "password": "demodemo1"},
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
