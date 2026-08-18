from __future__ import annotations


def test_health(client) -> None:
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_signup_signin_org_isolation(client, unique: str) -> None:
    a = client.post(
        "/v1/auth/signup",
        json={"email": f"a{unique}@hull.test", "password": "demodemo1"},
    )
    assert a.status_code == 201, a.text
    assert a.json()["org"] is None
    org = client.post("/v1/orgs", json={"name": f"Org A {unique}"})
    assert org.status_code == 201
    org_id = org.json()["org"]["id"]
    me = client.get("/v1/me")
    assert me.json()["org"]["id"] == org_id

    other = client.post(
        "/v1/auth/signup",
        json={"email": f"b{unique}@hull.test", "password": "demodemo1"},
    )
    assert other.status_code == 201
    stolen = client.post("/v1/session/org", json={"id": org_id})
    assert stolen.status_code == 404


def test_signup_duplicate_email(client, unique: str) -> None:
    body = {"email": f"dup{unique}@hull.test", "password": "demodemo1"}
    assert client.post("/v1/auth/signup", json=body).status_code == 201
    again = client.post(
        "/v1/auth/signup",
        json={"email": f"dup{unique}@hull.test", "password": "demodemo1"},
    )
    assert again.status_code == 409
    assert again.json()["reason_code"] == "email_taken"


def test_me_requires_session(client) -> None:
    assert client.get("/v1/me").status_code == 401


def test_admin_forbidden(client, unique: str) -> None:
    client.post(
        "/v1/auth/signup",
        json={"email": f"z{unique}@hull.test", "password": "demodemo1"},
    )
    res = client.get("/v1/admin/users")
    assert res.status_code == 403


def test_signup_does_not_ask_for_a_username(client, unique: str) -> None:
    """The account is made of an address and a password, and nothing else.

    A body that still carries a username is accepted and the field ignored —
    pydantic drops what the model does not declare — so this asserts the *result*
    rather than the request: the account exists and holds no username.
    """
    res = client.post(
        "/v1/auth/signup",
        json={"email": f"nou{unique}@hull.test", "password": "demodemo1"},
    )
    assert res.status_code == 201, res.text
    assert res.json()["user"]["username"] is None


def test_a_username_can_still_be_claimed_afterwards(client, unique: str) -> None:
    """It moved, it did not go. Signup stopped asking; the account page still
    offers one, and it is still unique across the install."""
    client.post(
        "/v1/auth/signup",
        json={"email": f"claim{unique}@hull.test", "password": "demodemo1"},
    )
    res = client.patch("/v1/me", json={"username": f"claim{unique}"})
    assert res.status_code == 200, res.text
    assert res.json()["user"]["username"] == f"claim{unique}"


def test_two_accounts_cannot_claim_the_same_username(client, settings, unique: str) -> None:
    """The partial unique index still bites, now on the only path that can reach
    it. Before this change the collision happened at signup; the guard has to
    follow the field rather than stay where the field used to be."""
    from fastapi.testclient import TestClient

    from hull_fastapi.api import create_app

    client.post(
        "/v1/auth/signup",
        json={"email": f"one{unique}@hull.test", "password": "demodemo1"},
    )
    assert client.patch("/v1/me", json={"username": f"dup{unique}"}).status_code == 200

    other = TestClient(create_app(settings))
    other.post(
        "/v1/auth/signup",
        json={"email": f"two{unique}@hull.test", "password": "demodemo1"},
    )
    res = other.patch("/v1/me", json={"username": f"dup{unique}"})
    assert res.status_code == 409, res.text
    assert res.json()["reason_code"] == "username_taken"
    assert res.json()["message_key"] == "error.usernameTaken"
