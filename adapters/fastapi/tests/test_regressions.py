"""Regressions for defects found in the 2026-08-16 adversarial review."""

from __future__ import annotations


def _signup(client, unique: str, tag: str = "a") -> str:
    res = client.post(
        "/v1/auth/signup",
        json={
            "username": f"u{unique}{tag}",
            "email": f"{tag}{unique}@hull.test",
            "password": "demodemo1",
        },
    )
    assert res.status_code == 201, res.text
    return res.json()["user"]["id"]


def test_password_change_rotates_the_callers_token(client, unique: str) -> None:
    """A stolen copy of the current cookie must not survive the password change."""
    _signup(client, unique)
    name = client.app.state.settings.cookie_name
    stolen = client.cookies[name]

    res = client.post("/v1/me/password", json={"current": "demodemo1", "password": "demodemo2"})
    assert res.status_code == 204, res.text

    # The caller stays signed in, on a different token.
    assert client.cookies[name] != stolen
    assert client.get("/v1/me").status_code == 200

    # The old token is dead.
    client.cookies.clear()
    client.cookies.set(name, stolen)
    assert client.get("/v1/me").status_code == 401


def test_second_signin_does_not_kill_the_first_session(client, unique: str) -> None:
    """Sessions are per-device; signing in elsewhere must not sign this one out."""
    _signup(client, unique)
    name = client.app.state.settings.cookie_name
    first = client.cookies[name]

    again = client.post(
        "/v1/auth/signin", json={"email": f"a{unique}@hull.test", "password": "demodemo1"}
    )
    assert again.status_code == 200
    assert client.cookies[name] != first

    client.cookies.clear()
    client.cookies.set(name, first)
    assert client.get("/v1/me").status_code == 200


def test_clearing_the_display_name_actually_clears_it(client, unique: str) -> None:
    """COALESCE used to discard the write while the UI reported a save."""
    _signup(client, unique)
    assert client.patch("/v1/me", json={"name": "Ada Lovelace"}).status_code == 200
    assert client.get("/v1/me").json()["user"]["name"] == "Ada Lovelace"

    res = client.patch("/v1/me", json={"name": ""})
    assert res.status_code == 200
    assert res.json()["user"]["name"] is None
    assert client.get("/v1/me").json()["user"]["name"] is None


def test_omitted_field_is_left_alone(client, unique: str) -> None:
    _signup(client, unique)
    client.patch("/v1/me", json={"name": "Ada"})
    res = client.patch("/v1/me", json={"username": f"u{unique}z"})
    assert res.status_code == 200
    assert res.json()["user"]["name"] == "Ada"


def test_malformed_org_id_is_422_not_500(client, unique: str) -> None:
    """A non-UUID id used to reach Postgres and raise an uncaught 500."""
    _signup(client, unique)
    res = client.post("/v1/session/org", json={"id": "not-a-uuid"})
    assert res.status_code == 422, res.text
    assert res.json()["reason_code"] == "request_validation_error"


def test_wellformed_but_unknown_org_id_is_still_404(client, unique: str) -> None:
    _signup(client, unique)
    res = client.post("/v1/session/org", json={"id": "11111111-1111-4111-8111-111111111111"})
    assert res.status_code == 404
    assert res.json()["reason_code"] == "not_found"


def test_oversized_upload_is_refused_before_it_is_buffered(client, unique: str) -> None:
    """The 5 MB cap used to be checked only after the whole body was in memory."""
    _signup(client, unique)
    res = client.post(
        "/v1/me/avatar",
        files={"file": ("big.png", b"\x00" * (6 * 1024 * 1024), "image/png")},
    )
    assert res.status_code == 413, res.text
    assert res.json()["reason_code"] == "request_validation_error"


def test_generated_openapi_docs_are_not_published(client) -> None:
    """contracts/openapi.yaml is the contract; the adapter must not serve a rival."""
    for path in ("/docs", "/redoc", "/openapi.json"):
        assert client.get(path).status_code == 404, path


def test_signin_is_constant_time_shaped_for_unknown_accounts(client, unique: str) -> None:
    """Both branches must run the hash; this just pins the response shape."""
    res = client.post(
        "/v1/auth/signin", json={"email": f"nobody{unique}@hull.test", "password": "demodemo1"}
    )
    assert res.status_code == 401
    assert res.json()["reason_code"] == "unauthenticated"
