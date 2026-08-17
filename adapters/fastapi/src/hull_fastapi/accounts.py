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
# The hand-off token only has to survive one redirect.
HANDOFF_TTL = timedelta(seconds=60)
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
    got = hashlib.scrypt(
        password.encode(), salt=bytes.fromhex(salt_hex), n=2**14, r=8, p=1, dklen=32
    )
    return hmac.compare_digest(got, bytes.fromhex(dk_hex))


def hash_session(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


_dummy_hash: str | None = None


def _dummy_password_hash() -> str:
    """A throwaway hash so a missing user costs the same as a wrong password."""
    global _dummy_hash
    if _dummy_hash is None:
        _dummy_hash = hash_password(secrets.token_urlsafe(16))
    return _dummy_hash


def new_session_secret() -> str:
    return secrets.token_urlsafe(32)


def _username(value: str) -> str:
    raw = value.strip().lower()
    if not _USERNAME_RE.match(raw):
        raise AccountError(
            "request_validation_error", "username must be 3–24 letters, numbers, or _"
        )
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
    # Deliberately not `org_id`. Reading this directly ignores impersonation —
    # go through effective_org_id() instead. The name is awkward on purpose.
    session_org_id: str | None
    org_name: str | None
    platform_role: str | None
    avatar_key: str | None
    acting_org_id: str | None
    acting_org_name: str | None
    acting_expires_at: datetime | None

    def acting(self) -> dict[str, Any] | None:
        """The live impersonation, or None.

        The role check lives here so the chrome and the data scope can never
        disagree: a demoted operator holding an impersonating session stops
        seeing the acting org *and* stops resolving to it, in the same place.
        """
        if self.platform_role != "platform_admin":
            return None
        if not (self.acting_org_id and self.acting_org_name and self.acting_expires_at):
            return None
        exp = self.acting_expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=UTC)
        if exp <= datetime.now(UTC):
            return None
        return {
            "org": {"id": self.acting_org_id, "name": self.acting_org_name},
            "expires_at": exp.isoformat(),
        }


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
    acting = sess.acting()
    org = None
    if acting:
        org = acting["org"]
    elif sess.session_org_id and sess.org_name:
        org = {"id": sess.session_org_id, "name": sess.org_name}
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
        # Sessions are per-device. Only sweep the user's expired rows here —
        # deleting all of them would sign every other device out on each signin.
        cur.execute(
            "DELETE FROM sessions WHERE user_id = %s AND expires_at <= now()",
            (user_id,),
        )
        cur.execute(
            """
            INSERT INTO sessions (id, session_hash, user_id, org_id, expires_at)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                str(uuid.uuid4()),
                hash_session(raw),
                user_id,
                org_id,
                datetime.now(UTC) + SESSION_TTL,
            ),
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
        session_org_id=str(row["org_id"]) if row["org_id"] else None,
        org_name=row["org_name"],
        platform_role=row["platform_role"],
        avatar_key=row["avatar_key"],
        acting_org_id=str(row["acting_org_id"]) if row["acting_org_id"] else None,
        acting_org_name=row["acting_org_name"],
        acting_expires_at=row["acting_expires_at"],
    )


def signup(
    conn: psycopg.Connection, *, username: str, email: str, password: str
) -> tuple[dict[str, Any], str]:
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
    # Always spend the scrypt cost, so a missing account is not distinguishable
    # from a wrong password by response time.
    stored = str(row["password_hash"]) if row else _dummy_password_hash()
    if not verify_password(password, stored) or not row:
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


def update_profile(
    conn: psycopg.Connection, *, user_id: str, username: str | None, name: str | None
) -> None:
    """Update only the fields the caller sent.

    `None` means "not provided, leave alone". An empty `name` clears the column —
    the old COALESCE form silently discarded that and the UI still reported a save.
    """
    sets: list[str] = []
    params: list[Any] = []
    if username is not None:
        sets.append("username = %s")
        params.append(_username(username))
    if name is not None:
        dname = name.strip()
        if len(dname) > 80:
            raise AccountError("request_validation_error", "name is too long")
        sets.append("display_name = %s")
        params.append(dname or None)
    if not sets:
        return
    params.append(user_id)
    try:
        with conn.cursor() as cur:
            cur.execute(f"UPDATE users SET {', '.join(sets)} WHERE id = %s", tuple(params))
        conn.commit()
    except UniqueViolation as exc:
        conn.rollback()
        raise AccountError("username_taken", "username is taken") from exc


def change_password(conn: psycopg.Connection, *, user_id: str, current: str, password: str) -> str:
    """Change the password and return a fresh session token.

    Every existing session dies, including the caller's own — otherwise a stolen
    copy of the current cookie survives the very action taken to revoke it. The
    caller gets a new token so they stay signed in.
    """
    _require_password(password)
    with conn.cursor() as cur:
        cur.execute("SELECT password_hash FROM users WHERE id = %s", (user_id,))
        row = cur.fetchone()
    if not row or not verify_password(current, str(row["password_hash"])):
        raise AccountError("unauthenticated", "current password is wrong")
    with conn.cursor() as cur:
        cur.execute("SELECT org_id FROM sessions WHERE user_id = %s LIMIT 1", (user_id,))
        prev = cur.fetchone()
        org_id = str(prev["org_id"]) if prev and prev["org_id"] else None
        cur.execute(
            "UPDATE users SET password_hash = %s WHERE id = %s", (hash_password(password), user_id)
        )
        cur.execute("DELETE FROM sessions WHERE user_id = %s", (user_id,))
    token = _insert_session(conn, user_id=user_id, org_id=org_id)
    conn.commit()
    return token


def close_account(
    conn: psycopg.Connection, *, user_id: str, password: str, platform_role: str | None
) -> None:
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


def _insert_support_session(conn: psycopg.Connection, *, user_id: str, org_id: str) -> str:
    """A session that exists only to view one org, on the customer surface.

    org_id stays NULL — the admin is not a member. The org they see comes from
    acting_org_id, and the row dies with SUPPORT_TTL rather than SESSION_TTL.
    """
    raw = new_session_secret()
    expires = datetime.now(UTC) + SUPPORT_TTL
    with conn.cursor() as cur:
        cur.execute("DELETE FROM sessions WHERE user_id = %s AND expires_at <= now()", (user_id,))
        cur.execute(
            """
            INSERT INTO sessions (id, session_hash, user_id, org_id, acting_org_id, acting_expires_at, expires_at)
            VALUES (%s, %s, %s, NULL, %s, %s, %s)
            """,
            (str(uuid.uuid4()), hash_session(raw), user_id, org_id, expires, expires),
        )
    return raw


def support_start(conn: psycopg.Connection, *, user_id: str, org_id: str) -> str:
    """Mint a one-time hand-off token. Does not touch the caller's session.

    Impersonation lives on the customer surface, which is where data is scoped.
    The admin console stays the admin console.
    """
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM orgs WHERE id = %s", (org_id,))
        if not cur.fetchone():
            raise AccountError("not_found", "workspace not found")
        raw = new_session_secret()
        cur.execute(
            """
            INSERT INTO support_handoffs (id, token_hash, user_id, org_id, expires_at)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                str(uuid.uuid4()),
                hash_session(raw),
                user_id,
                org_id,
                datetime.now(UTC) + HANDOFF_TTL,
            ),
        )
    conn.commit()
    return raw


def consume_handoff(conn: psycopg.Connection, *, raw: str) -> tuple[dict[str, Any], str]:
    """Exchange a hand-off token for an impersonating session on this host."""
    if not raw:
        raise AccountError("unauthenticated", "hand-off link is invalid or expired")
    with conn.cursor() as cur:
        # Claim and consume in one statement: two concurrent redemptions of the
        # same token cannot both match `used_at IS NULL`.
        cur.execute(
            """
            UPDATE support_handoffs
            SET used_at = now()
            WHERE token_hash = %s AND used_at IS NULL AND expires_at > now()
            RETURNING user_id, org_id
            """,
            (hash_session(raw),),
        )
        row = cur.fetchone()
        if not row:
            conn.rollback()
            raise AccountError("unauthenticated", "hand-off link is invalid or expired")
        user_id = str(row["user_id"])
        org_id = str(row["org_id"])
        # Re-check the role at redemption, not only when the token was minted —
        # the operator may have been demoted in between.
        cur.execute("SELECT platform_role FROM users WHERE id = %s", (user_id,))
        actor = cur.fetchone()
    if not actor or actor["platform_role"] != "platform_admin":
        conn.rollback()
        raise AccountError("forbidden", "platform admin required")
    token = _insert_support_session(conn, user_id=user_id, org_id=org_id)
    conn.commit()
    sess = load_session(conn, token)
    assert sess is not None
    return me_body(conn, sess), token


def support_stop(conn: psycopg.Connection, *, raw: str) -> None:
    """End impersonation by ending the session it lives on."""
    with conn.cursor() as cur:
        cur.execute("DELETE FROM sessions WHERE session_hash = %s", (hash_session(raw),))
    conn.commit()


def effective_org_id(sess: SessionPrincipal) -> str | None:
    """The org this request operates on. The only supported way to get it.

    Product modules must call this rather than reading the session field. A
    support operator's session carries the customer's org in acting_org_id and
    nothing in session_org_id, so reading the raw field would silently scope an
    impersonated request to no org at all — or, once modules keep their own
    org column, to the wrong one.
    """
    if sess.acting() is not None:
        return sess.acting_org_id
    return sess.session_org_id
