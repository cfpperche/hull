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
# A reset link has to survive a trip through a mail client, so it cannot be
# measured in seconds — but it is the one credential that arrives unauthenticated,
# so it does not get to live for a day either.
RESET_TTL = timedelta(minutes=30)
# Longer, because it is worth less: redeeming a verification link proves someone
# reached the mailbox, and grants nothing. Signup is also the worst moment to
# demand promptness — the mail lands while the person is already busy elsewhere.
VERIFY_TTL = timedelta(days=3)
# In between the two. Confirming a change moves the address that recovers the
# account, so it is not a three-day link — but the person is deliberately mid-task
# with two mailboxes open, and half an hour is not enough to reach a phone.
EMAIL_CHANGE_TTL = timedelta(hours=2)
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


def _require_email(email: str) -> str:
    normalized = normalize_email(email)
    if not normalized or "@" not in normalized:
        raise AccountError("request_validation_error", "email is required")
    return normalized


def _require_password(password: str) -> None:
    if len(password) < 8:
        raise AccountError("request_validation_error", "password must be at least 8 characters")


# How stale last_seen_at is allowed to get before a request pays for a write.
# A list a human reads does not need finer, and finer makes every authenticated
# GET a write.
SEEN_GRANULARITY = timedelta(minutes=1)
# Anything longer is not a device name, it is someone probing how much text this
# column will hold.
MAX_USER_AGENT = 400


def _device_label(user_agent: str | None) -> str:
    """A short, deliberately dumb reading of a User-Agent string.

    Not a parser. User-Agent is a pile of historical lies — every browser claims
    to be Mozilla, Edge claims to be Chrome, Chrome claims to be Safari — and a
    library that keeps up with it is a dependency and a subscription. This answers
    the only question the list is asking, "which of these is the machine in front
    of me", and says so honestly when it cannot tell.
    """
    ua = user_agent or ""
    if not ua.strip():
        return "Unknown device"
    browser = next(
        (
            name
            for token, name in (
                # Order matters: every one of these also contains the tokens of
                # the ones below it.
                ("Edg/", "Edge"),
                ("OPR/", "Opera"),
                ("Chrome/", "Chrome"),
                ("Firefox/", "Firefox"),
                ("Safari/", "Safari"),
            )
            if token in ua
        ),
        None,
    )
    system = next(
        (
            name
            for token, name in (
                ("iPhone", "iPhone"),
                ("iPad", "iPad"),
                ("Android", "Android"),
                ("Windows", "Windows"),
                ("Mac OS X", "macOS"),
                ("Linux", "Linux"),
            )
            if token in ua
        ),
        None,
    )
    if browser and system:
        return f"{browser} on {system}"
    return browser or system or "Unknown device"


@dataclass(frozen=True)
class SessionPrincipal:
    # The row's id, not its secret. The secret is session_hash and never leaves
    # the database; this is what lets the session list say which row is you.
    session_id: str
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
    email_verified_at: datetime | None
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
            "email_verified": sess.email_verified_at is not None,
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
    user_agent: str | None = None,
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
            INSERT INTO sessions (id, session_hash, user_id, org_id, user_agent, expires_at)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                str(uuid.uuid4()),
                hash_session(raw),
                user_id,
                org_id,
                (user_agent or "")[:MAX_USER_AGENT] or None,
                datetime.now(UTC) + SESSION_TTL,
            ),
        )
    return raw


def _touch_session(conn: psycopg.Connection, session_id: str) -> None:
    """Record that this session is alive, at most once a minute.

    The WHERE clause is what keeps this cheap: without it every authenticated
    GET becomes a write, and a page that fires five requests writes five times to
    say the same thing. It commits on its own because the caller may be in the
    middle of a read that never commits.
    """
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE sessions SET last_seen_at = now() WHERE id = %s AND last_seen_at < %s",
            (session_id, datetime.now(UTC) - SEEN_GRANULARITY),
        )
    conn.commit()


def load_session(conn: psycopg.Connection, raw: str) -> SessionPrincipal | None:
    if not raw:
        return None
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT s.id, s.user_id, u.email, u.username, u.display_name, u.platform_role,
                   u.avatar_key, u.email_verified_at,
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
    _touch_session(conn, str(row["id"]))
    return SessionPrincipal(
        session_id=str(row["id"]),
        user_id=str(row["user_id"]),
        email=str(row["email"]),
        username=row["username"],
        display_name=row["display_name"],
        session_org_id=str(row["org_id"]) if row["org_id"] else None,
        org_name=row["org_name"],
        platform_role=row["platform_role"],
        avatar_key=row["avatar_key"],
        email_verified_at=row["email_verified_at"],
        acting_org_id=str(row["acting_org_id"]) if row["acting_org_id"] else None,
        acting_org_name=row["acting_org_name"],
        acting_expires_at=row["acting_expires_at"],
    )


def signup(
    conn: psycopg.Connection,
    *,
    username: str,
    email: str,
    password: str,
    user_agent: str | None = None,
) -> tuple[dict[str, Any], str]:
    email_n = _require_email(email)
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
        token = _insert_session(conn, user_id=user_id, org_id=None, user_agent=user_agent)
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


def signin(
    conn: psycopg.Connection, *, email: str, password: str, user_agent: str | None = None
) -> tuple[dict[str, Any], str]:
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
    token = _insert_session(
        conn,
        user_id=user_id,
        org_id=str(first["id"]) if first else None,
        user_agent=user_agent,
    )
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


def change_password(
    conn: psycopg.Connection,
    *,
    user_id: str,
    current: str,
    password: str,
    user_agent: str | None = None,
) -> str:
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
        _cancel_email_changes(cur, user_id)
    token = _insert_session(conn, user_id=user_id, org_id=org_id, user_agent=user_agent)
    conn.commit()
    return token


def request_password_reset(conn: psycopg.Connection, *, email: str) -> str | None:
    """Mint a reset token, or None when nobody holds that address.

    Returning None rather than raising is deliberate: the caller answers the same
    way either way. A "no such account" response turns this endpoint into a free
    membership oracle for any address someone cares to try.
    """
    email_n = normalize_email(email)
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM users WHERE lower(email) = %s", (email_n,))
        row = cur.fetchone()
        if not row:
            return None
        raw = new_session_secret()
        cur.execute(
            """
            INSERT INTO password_resets (id, token_hash, user_id, expires_at)
            VALUES (%s, %s, %s, %s)
            """,
            (str(uuid.uuid4()), hash_session(raw), str(row["id"]), datetime.now(UTC) + RESET_TTL),
        )
    conn.commit()
    return raw


def reset_password(conn: psycopg.Connection, *, raw: str, password: str) -> None:
    """Redeem a reset token and set a new password.

    Does not sign the caller in. Someone arriving here has just proved control of
    the mailbox, not of the password they are about to replace — and the sign-in
    they do next is the cheapest possible confirmation that the new one works.
    """
    _require_password(password)
    if not raw:
        raise AccountError("unauthenticated", "reset link is invalid or expired")
    with conn.cursor() as cur:
        # Claim and consume in one statement, like consume_handoff: two clicks on
        # the same link cannot both match `used_at IS NULL`.
        cur.execute(
            """
            UPDATE password_resets
            SET used_at = now()
            WHERE token_hash = %s AND used_at IS NULL AND expires_at > now()
            RETURNING user_id
            """,
            (hash_session(raw),),
        )
        row = cur.fetchone()
        if not row:
            conn.rollback()
            raise AccountError("unauthenticated", "reset link is invalid or expired")
        user_id = str(row["user_id"])
        cur.execute(
            "UPDATE users SET password_hash = %s WHERE id = %s", (hash_password(password), user_id)
        )
        # Every session dies. A reset is what someone does when they believe they
        # have lost control of the account, so leaving the sessions an attacker
        # may be holding would answer the wrong question.
        cur.execute("DELETE FROM sessions WHERE user_id = %s", (user_id,))
        # Any other outstanding link for this user dies with it — including the
        # older ones from a user who clicked "forgot" three times.
        cur.execute(
            "UPDATE password_resets SET used_at = now() WHERE user_id = %s AND used_at IS NULL",
            (user_id,),
        )
        _cancel_email_changes(cur, user_id)
    conn.commit()


def request_email_verification(conn: psycopg.Connection, *, user_id: str) -> tuple[str, str] | None:
    """Mint a verification link, or None when there is nothing to verify.

    Returns (token, address). The address is stored with the token because a link
    minted for one address must not confirm the one that replaced it — the day
    changing your email exists, that is the difference between verification and
    a rubber stamp.
    """
    with conn.cursor() as cur:
        cur.execute("SELECT email, email_verified_at FROM users WHERE id = %s", (user_id,))
        row = cur.fetchone()
        if not row or row["email_verified_at"] is not None:
            return None
        email = str(row["email"])
        raw = new_session_secret()
        cur.execute(
            """
            INSERT INTO email_verifications (id, token_hash, user_id, email, expires_at)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (str(uuid.uuid4()), hash_session(raw), user_id, email, datetime.now(UTC) + VERIFY_TTL),
        )
    conn.commit()
    return raw, email


def verify_email(conn: psycopg.Connection, *, raw: str) -> str:
    """Redeem a verification link. Returns the address that got confirmed."""
    if not raw:
        raise AccountError("unauthenticated", "verification link is invalid or expired")
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE email_verifications
            SET used_at = now()
            WHERE token_hash = %s AND used_at IS NULL AND expires_at > now()
            RETURNING user_id, email
            """,
            (hash_session(raw),),
        )
        row = cur.fetchone()
        if not row:
            conn.rollback()
            raise AccountError("unauthenticated", "verification link is invalid or expired")
        user_id, email = str(row["user_id"]), str(row["email"])
        # Only stamp the user if they still hold the address the link was sent to.
        # An address changed between minting and clicking leaves the link spent and
        # the account unverified, which is the honest outcome.
        cur.execute(
            """
            UPDATE users
            SET email_verified_at = now()
            WHERE id = %s AND lower(email) = lower(%s) AND email_verified_at IS NULL
            """,
            (user_id, email),
        )
        # Any other outstanding link for this user is spent with it.
        cur.execute(
            "UPDATE email_verifications SET used_at = now() WHERE user_id = %s AND used_at IS NULL",
            (user_id,),
        )
    conn.commit()
    return email


def _cancel_email_changes(cur: psycopg.Cursor, user_id: str) -> None:
    """Spend every pending address change for this user.

    Called from both password paths, and that is what makes the warning mail
    worth sending: "if this was not you, change your password" has to actually
    stop the change, or it is advice that does nothing.
    """
    cur.execute(
        "UPDATE email_changes SET used_at = now() WHERE user_id = %s AND used_at IS NULL",
        (user_id,),
    )


def request_email_change(
    conn: psycopg.Connection, *, user_id: str, password: str, email: str
) -> tuple[str, str, str]:
    """Mint a link that moves the account to a new address. Returns (token, new, old).

    The password is confirmed here rather than at redemption, because this is the
    step an attacker holding a stolen cookie would reach — and it is the only one
    where the account's real owner is still the only person who can pass. What the
    link proves afterwards is narrower: that somebody reads the new mailbox.

    Nothing changes yet. The old address keeps signing in, keeps receiving reset
    mail, and is told what was asked for, until the new one answers.
    """
    new_email = _require_email(email)
    with conn.cursor() as cur:
        cur.execute("SELECT email, password_hash FROM users WHERE id = %s", (user_id,))
        row = cur.fetchone()
        if not row or not verify_password(password, str(row["password_hash"])):
            raise AccountError("unauthenticated", "password is wrong")
        old_email = str(row["email"])
        if normalize_email(old_email) == new_email:
            raise AccountError("request_validation_error", "that is already your address")
        # Answering "taken" to a signed-in user who has just proved the password
        # is not a new oracle — signup tells anyone at all the same thing. What it
        # buys is that the mail does not go out to somebody else's address.
        cur.execute(
            "SELECT 1 FROM users WHERE lower(email) = %s AND id <> %s", (new_email, user_id)
        )
        if cur.fetchone():
            raise AccountError("email_taken", "email is taken")
        raw = new_session_secret()
        cur.execute(
            """
            INSERT INTO email_changes (id, token_hash, user_id, new_email, old_email, expires_at)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                str(uuid.uuid4()),
                hash_session(raw),
                user_id,
                new_email,
                old_email,
                datetime.now(UTC) + EMAIL_CHANGE_TTL,
            ),
        )
    conn.commit()
    return raw, new_email, old_email


def confirm_email_change(conn: psycopg.Connection, *, raw: str) -> tuple[str, str]:
    """Redeem the link and move the address. Returns (new, old).

    Sessions survive on purpose. A reset kills them because it is what someone
    does after losing control; this is a deliberate edit made from a signed-in
    seat, and ending it would sign the person out of the laptop they started on
    because they finished the job on their phone.
    """
    if not raw:
        raise AccountError("unauthenticated", "this link is invalid or expired")
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE email_changes
            SET used_at = now()
            WHERE token_hash = %s AND used_at IS NULL AND expires_at > now()
            RETURNING user_id, new_email, old_email
            """,
            (hash_session(raw),),
        )
        row = cur.fetchone()
        if not row:
            conn.rollback()
            raise AccountError("unauthenticated", "this link is invalid or expired")
        user_id = str(row["user_id"])
        new_email, old_email = str(row["new_email"]), str(row["old_email"])
        try:
            # Verified in the same statement that moves it: redeeming this link is
            # the same proof the verification link asks for, so making the person
            # confirm the address twice would be theatre.
            cur.execute(
                "UPDATE users SET email = %s, email_verified_at = now() WHERE id = %s",
                (new_email, user_id),
            )
        except UniqueViolation as exc:
            # Somebody signed up with that address while the link sat in the
            # inbox. Rolling back un-spends the token, which is useless now but
            # honest — the answer is to ask for a different address, not to be
            # told the link was broken.
            conn.rollback()
            raise AccountError("email_taken", "email is taken") from exc
        _cancel_email_changes(cur, user_id)
        # Any verification link for the old address dies here too. verify_email
        # already refuses to stamp an address the user no longer holds, so this
        # is tidiness rather than the guard — but it keeps "outstanding link" and
        # "usable link" the same set.
        cur.execute(
            "UPDATE email_verifications SET used_at = now() WHERE user_id = %s AND used_at IS NULL",
            (user_id,),
        )
    conn.commit()
    return new_email, old_email


def list_sessions(
    conn: psycopg.Connection, *, user_id: str, current_id: str
) -> list[dict[str, Any]]:
    """Every live session of this user, most recently used first.

    Expired rows are excluded rather than deleted — sweeping them is sign-in's
    job, and a list that quietly rewrites the table on every read is a surprise
    waiting to happen.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, user_agent, created_at, last_seen_at, acting_org_id
            FROM sessions
            WHERE user_id = %s AND expires_at > now()
            ORDER BY last_seen_at DESC
            """,
            (user_id,),
        )
        rows = cur.fetchall()
    return [
        {
            "id": str(r["id"]),
            "device": _device_label(r["user_agent"]),
            "created_at": r["created_at"].isoformat(),
            "last_seen_at": r["last_seen_at"].isoformat(),
            # A support session is the operator's own, taken to view a customer.
            # It shows here because it *is* theirs, and it is worth naming rather
            # than leaving as an unexplained extra row.
            "support": r["acting_org_id"] is not None,
            "current": str(r["id"]) == current_id,
        }
        for r in rows
    ]


def revoke_session(conn: psycopg.Connection, *, user_id: str, session_id: str) -> None:
    """End one session. No password, on purpose.

    Revoking only ever takes access away. Putting a credential in front of it
    would make the safe action the slow one, at the exact moment somebody has
    decided they do not trust a device.
    """
    with conn.cursor() as cur:
        # user_id in the WHERE, not checked afterwards: this is the only thing
        # stopping one user ending another's session by pasting an id.
        cur.execute(
            "DELETE FROM sessions WHERE id = %s AND user_id = %s",
            (session_id, user_id),
        )
        gone = cur.rowcount
    conn.commit()
    if not gone:
        raise AccountError("not_found", "session not found")


def revoke_other_sessions(conn: psycopg.Connection, *, user_id: str, keep_id: str) -> int:
    """End every session except the caller's own. Returns how many died."""
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM sessions WHERE user_id = %s AND id <> %s",
            (user_id, keep_id),
        )
        gone = cur.rowcount
    conn.commit()
    return gone


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


def _insert_support_session(
    conn: psycopg.Connection, *, user_id: str, org_id: str, user_agent: str | None = None
) -> str:
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
            INSERT INTO sessions
                (id, session_hash, user_id, org_id, acting_org_id, acting_expires_at,
                 user_agent, expires_at)
            VALUES (%s, %s, %s, NULL, %s, %s, %s, %s)
            """,
            (
                str(uuid.uuid4()),
                hash_session(raw),
                user_id,
                org_id,
                expires,
                (user_agent or "")[:MAX_USER_AGENT] or None,
                expires,
            ),
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


def consume_handoff(
    conn: psycopg.Connection, *, raw: str, user_agent: str | None = None
) -> tuple[dict[str, Any], str]:
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
    token = _insert_support_session(conn, user_id=user_id, org_id=org_id, user_agent=user_agent)
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
