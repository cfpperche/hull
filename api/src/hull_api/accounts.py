from __future__ import annotations

import hashlib
import hmac
import re
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import psycopg
from psycopg.errors import UniqueViolation

SESSION_TTL = timedelta(days=14)
SUPPORT_TTL = timedelta(minutes=45)
_USERNAME_RE = re.compile(r"^[a-z0-9_]{3,24}$")


class AccountError(Exception):
    def __init__(self, reason_code: str, message: str) -> None:
        super().__init__(message)
        self.reason_code = reason_code
        self.message = message


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return f"scrypt${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        kind, salt_hex, dk_hex = stored.split("$", 2)
    except ValueError:
        return False
    if kind != "scrypt":
        return False
    got = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), n=2**14, r=8, p=1, dklen=32)
    return hmac.compare_digest(got, bytes.fromhex(dk_hex))


def hash_session(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def new_session_secret() -> str:
    return secrets.token_urlsafe(32)


def _username(value: str) -> str:
    raw = value.strip().lower()
    if not _USERNAME_RE.match(raw):
        raise AccountError("request_validation_error", "username must be 3–24 letters, numbers, or _")
    return raw


def _require_name(value: str, field: str) -> str:
    name = value.strip()
    if not name or len(name) > 80:
        raise AccountError("request_validation_error", f"{field} is required")
    return name


def _require_password(password: str) -> None:
    if len(password) < 8:
        raise AccountError("request_validation_error", "password must be at least 8 characters")


@dataclass(frozen=True)
class SessionPrincipal:
    user_id: str
    email: str
    username: str | None
    display_name: str | None
    org_id: str | None
    org_name: str | None
    platform_role: str | None
    avatar_key: str | None
    acting_org_id: str | None
    acting_org_name: str | None
    acting_expires_at: datetime | None


def _orgs_for(conn: psycopg.Connection, user_id: str) -> list[dict[str, str]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT o.id, o.name
            FROM orgs o
            JOIN org_members m ON m.org_id = o.id
            WHERE m.user_id = %s
            ORDER BY o.created_at
            """,
            (user_id,),
        )
        return [{"id": str(r["id"]), "name": str(r["name"])} for r in cur.fetchall()]


def me_body(conn: psycopg.Connection, sess: SessionPrincipal) -> dict[str, Any]:
    acting = None
    if sess.acting_org_id and sess.acting_org_name and sess.acting_expires_at:
        exp = sess.acting_expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=UTC)
        if exp > datetime.now(UTC):
            acting = {
                "org": {"id": sess.acting_org_id, "name": sess.acting_org_name},
                "expires_at": exp.isoformat(),
            }
    org = None
    if acting:
        org = acting["org"]
    elif sess.org_id and sess.org_name:
        org = {"id": sess.org_id, "name": sess.org_name}
    return {
        "user": {
            "id": sess.user_id,
            "email": sess.email,
            "username": sess.username,
            "name": sess.display_name,
            "has_avatar": bool(sess.avatar_key),
        },
        "org": org,
        "orgs": _orgs_for(conn, sess.user_id),
        "platform_role": sess.platform_role,
        "acting": acting,
    }


def _insert_session(
    conn: psycopg.Connection,
    *,
    user_id: str,
    org_id: str | None,
) -> str:
    raw = new_session_secret()
    with conn.cursor() as cur:
        cur.execute("DELETE FROM sessions WHERE user_id = %s", (user_id,))
        cur.execute(
            """
            INSERT INTO sessions (id, session_hash, user_id, org_id, expires_at)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (str(uuid.uuid4()), hash_session(raw), user_id, org_id, datetime.now(UTC) + SESSION_TTL),
        )
    return raw


def load_session(conn: psycopg.Connection, raw: str) -> SessionPrincipal | None:
    if not raw:
        return None
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT s.user_id, u.email, u.username, u.display_name, u.platform_role, u.avatar_key,
                   s.org_id, o.name AS org_name,
                   s.acting_org_id, ao.name AS acting_org_name, s.acting_expires_at, s.expires_at
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            LEFT JOIN orgs o ON o.id = s.org_id
            LEFT JOIN orgs ao ON ao.id = s.acting_org_id
            WHERE s.session_hash = %s
            """,
            (hash_session(raw),),
        )
        row = cur.fetchone()
    if not row:
        return None
    exp = row["expires_at"]
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=UTC)
    if exp <= datetime.now(UTC):
        return None
    return SessionPrincipal(
        user_id=str(row["user_id"]),
        email=str(row["email"]),
        username=row["username"],
        display_name=row["display_name"],
        org_id=str(row["org_id"]) if row["org_id"] else None,
        org_name=row["org_name"],
        platform_role=row["platform_role"],
        avatar_key=row["avatar_key"],
        acting_org_id=str(row["acting_org_id"]) if row["acting_org_id"] else None,
        acting_org_name=row["acting_org_name"],
        acting_expires_at=row["acting_expires_at"],
    )


def signup(conn: psycopg.Connection, *, username: str, email: str, password: str) -> tuple[dict[str, Any], str]:
    email_n = normalize_email(email)
    if not email_n or "@" not in email_n:
        raise AccountError("request_validation_error", "email is required")
    uname = _username(username)
    _require_password(password)
    user_id = str(uuid.uuid4())
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO users (id, email, username, password_hash)
                VALUES (%s, %s, %s, %s)
                """,
                (user_id, email_n, uname, hash_password(password)),
            )
        token = _insert_session(conn, user_id=user_id, org_id=None)
        conn.commit()
    except UniqueViolation as exc:
        conn.rollback()
        constraint = getattr(exc, "diag", None)
        name = getattr(constraint, "constraint_name", "") if constraint else ""
        if name and "username" in name:
            raise AccountError("username_taken", "username is taken") from exc
        raise AccountError("email_taken", "email is taken") from exc
    sess = load_session(conn, token)
    assert sess is not None
    return me_body(conn, sess), token


def signin(conn: psycopg.Connection, *, email: str, password: str) -> tuple[dict[str, Any], str]:
    email_n = normalize_email(email)
    with conn.cursor() as cur:
        cur.execute("SELECT id, password_hash FROM users WHERE lower(email) = %s", (email_n,))
        row = cur.fetchone()
    if not row or not verify_password(password, str(row["password_hash"])):
        raise AccountError("unauthenticated", "invalid email or password")
    user_id = str(row["id"])
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT o.id
            FROM orgs o
            JOIN org_members m ON m.org_id = o.id
            WHERE m.user_id = %s
            ORDER BY o.created_at
            LIMIT 1
            """,
            (user_id,),
        )
        first = cur.fetchone()
    token = _insert_session(conn, user_id=user_id, org_id=str(first["id"]) if first else None)
    conn.commit()
    sess = load_session(conn, token)
    assert sess is not None
    return me_body(conn, sess), token


def signout(conn: psycopg.Connection, raw: str) -> None:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM sessions WHERE session_hash = %s", (hash_session(raw),))
    conn.commit()


def create_org(conn: psycopg.Connection, *, user_id: str, name: str, raw: str) -> dict[str, Any]:
    org_name = _require_name(name, "name")
    org_id = str(uuid.uuid4())
    with conn.cursor() as cur:
        cur.execute("INSERT INTO orgs (id, name) VALUES (%s, %s)", (org_id, org_name))
        cur.execute(
            "INSERT INTO org_members (user_id, org_id, role) VALUES (%s, %s, %s)",
            (user_id, org_id, "owner"),
        )
        cur.execute(
            "UPDATE sessions SET org_id = %s WHERE session_hash = %s",
            (org_id, hash_session(raw)),
        )
    conn.commit()
    sess = load_session(conn, raw)
    assert sess is not None
    return me_body(conn, sess)


def switch_org(conn: psycopg.Connection, *, user_id: str, org_id: str, raw: str) -> dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT 1 FROM org_members WHERE user_id = %s AND org_id = %s",
            (user_id, org_id),
        )
        if not cur.fetchone():
            raise AccountError("not_found", "workspace not found")
        cur.execute(
            "UPDATE sessions SET org_id = %s WHERE session_hash = %s",
            (org_id, hash_session(raw)),
        )
    conn.commit()
    sess = load_session(conn, raw)
    assert sess is not None
    return me_body(conn, sess)


def update_profile(conn: psycopg.Connection, *, user_id: str, username: str | None, name: str | None) -> None:
    uname = _username(username) if username else None
    dname = name.strip() if name else None
    if dname is not None and len(dname) > 80:
        raise AccountError("request_validation_error", "name is too long")
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET username = COALESCE(%s, username), display_name = COALESCE(%s, display_name) WHERE id = %s",
                (uname, dname, user_id),
            )
        conn.commit()
    except UniqueViolation as exc:
        conn.rollback()
        raise AccountError("username_taken", "username is taken") from exc


def change_password(conn: psycopg.Connection, *, user_id: str, current: str, password: str, keep_raw: str) -> None:
    _require_password(password)
    with conn.cursor() as cur:
        cur.execute("SELECT password_hash FROM users WHERE id = %s", (user_id,))
        row = cur.fetchone()
    if not row or not verify_password(current, str(row["password_hash"])):
        raise AccountError("unauthenticated", "current password is wrong")
    with conn.cursor() as cur:
        cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (hash_password(password), user_id))
        cur.execute(
            "DELETE FROM sessions WHERE user_id = %s AND session_hash <> %s",
            (user_id, hash_session(keep_raw)),
        )
    conn.commit()


def close_account(conn: psycopg.Connection, *, user_id: str, password: str, platform_role: str | None) -> None:
    if platform_role == "platform_admin":
        raise AccountError("forbidden", "platform admin cannot close")
    with conn.cursor() as cur:
        cur.execute("SELECT password_hash FROM users WHERE id = %s", (user_id,))
        row = cur.fetchone()
    if not row or not verify_password(password, str(row["password_hash"])):
        raise AccountError("unauthenticated", "password is wrong")
    with conn.cursor() as cur:
        cur.execute(
            """
            DELETE FROM orgs
            WHERE id IN (
                SELECT org_id FROM org_members WHERE user_id = %s AND role = 'owner'
            )
            AND id NOT IN (
                SELECT org_id FROM org_members WHERE user_id <> %s
            )
            """,
            (user_id, user_id),
        )
        cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
    conn.commit()


def set_avatar_key(conn: psycopg.Connection, *, user_id: str, key: str) -> None:
    with conn.cursor() as cur:
        cur.execute("UPDATE users SET avatar_key = %s WHERE id = %s", (key, user_id))
    conn.commit()


def require_admin(sess: SessionPrincipal) -> None:
    if sess.platform_role != "platform_admin":
        raise AccountError("forbidden", "platform admin required")


def list_users(conn: psycopg.Connection) -> list[dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, email, username, display_name, platform_role, avatar_key, created_at
            FROM users
            ORDER BY created_at
            """
        )
        rows = cur.fetchall()
    return [
        {
            "id": str(r["id"]),
            "email": r["email"],
            "username": r["username"],
            "name": r["display_name"],
            "has_avatar": bool(r["avatar_key"]),
            "platform_role": r["platform_role"],
            "created_at": r["created_at"].isoformat(),
        }
        for r in rows
    ]


def list_orgs(conn: psycopg.Connection) -> list[dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute("SELECT id, name, created_at FROM orgs ORDER BY created_at")
        rows = cur.fetchall()
    return [
        {"id": str(r["id"]), "name": r["name"], "created_at": r["created_at"].isoformat()}
        for r in rows
    ]


def support_start(conn: psycopg.Connection, *, raw: str, org_id: str) -> dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute("SELECT id, name FROM orgs WHERE id = %s", (org_id,))
        org = cur.fetchone()
        if not org:
            raise AccountError("not_found", "workspace not found")
        cur.execute(
            """
            UPDATE sessions
            SET acting_org_id = %s, acting_expires_at = %s
            WHERE session_hash = %s
            """,
            (org_id, datetime.now(UTC) + SUPPORT_TTL, hash_session(raw)),
        )
    conn.commit()
    sess = load_session(conn, raw)
    assert sess is not None
    return me_body(conn, sess)


def support_stop(conn: psycopg.Connection, *, raw: str) -> dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE sessions SET acting_org_id = NULL, acting_expires_at = NULL WHERE session_hash = %s",
            (hash_session(raw),),
        )
    conn.commit()
    sess = load_session(conn, raw)
    assert sess is not None
    return me_body(conn, sess)


def effective_org_id(sess: SessionPrincipal) -> str | None:
    if sess.platform_role == "platform_admin" and sess.acting_org_id:
        exp = sess.acting_expires_at
        if exp is not None:
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=UTC)
            if exp > datetime.now(UTC):
                return sess.acting_org_id
    return sess.org_id
