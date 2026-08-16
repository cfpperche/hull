from __future__ import annotations


def test_health(client) -> None:
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_signup_signin_org_isolation(client, unique: str) -> None:
    a = client.post(
        "/v1/auth/signup",
        json={"username": f"u{unique}a", "email": f"a{unique}@hull.dev", "password": "demodemo1"},
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
        json={"username": f"u{unique}b", "email": f"b{unique}@hull.dev", "password": "demodemo1"},
    )
    assert other.status_code == 201
    stolen = client.post("/v1/session/org", json={"id": org_id})
    assert stolen.status_code == 404


def test_signup_duplicate_email(client, unique: str) -> None:
    body = {"username": f"x{unique}", "email": f"dup{unique}@hull.dev", "password": "demodemo1"}
    assert client.post("/v1/auth/signup", json=body).status_code == 201
    again = client.post(
        "/v1/auth/signup",
        json={"username": f"y{unique}", "email": f"dup{unique}@hull.dev", "password": "demodemo1"},
    )
    assert again.status_code == 409
    assert again.json()["reason_code"] == "email_taken"


def test_me_requires_session(client) -> None:
    assert client.get("/v1/me").status_code == 401


def test_admin_forbidden(client, unique: str) -> None:
    client.post(
        "/v1/auth/signup",
        json={"username": f"z{unique}", "email": f"z{unique}@hull.dev", "password": "demodemo1"},
    )
    res = client.get("/v1/admin/users")
    assert res.status_code == 403
