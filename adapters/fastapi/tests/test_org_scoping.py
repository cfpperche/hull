"""Which org a request operates on.

`effective_org_id` had zero callers: impersonation set an acting org, the chrome
displayed it, and nothing scoped data by it. Harmless while there is no product
data — a cross-tenant bug the first time a module reads an org off the session.
"""

from __future__ import annotations

import pathlib
import re
from datetime import UTC, datetime, timedelta

from hull_fastapi.accounts import SessionPrincipal, effective_org_id

SRC = pathlib.Path(__file__).resolve().parents[1] / "src" / "hull_fastapi"
REPO = pathlib.Path(__file__).resolve().parents[3]


def _principal(**over) -> SessionPrincipal:
    base = dict(
        user_id="u1",
        email="op@hull.test",
        username="op",
        display_name="Op",
        session_org_id=None,
        org_name=None,
        platform_role=None,
        avatar_key=None,
        acting_org_id=None,
        acting_org_name=None,
        acting_expires_at=None,
    )
    base.update(over)
    return SessionPrincipal(**base)


def test_ordinary_member_resolves_to_their_own_org() -> None:
    sess = _principal(session_org_id="org-a", org_name="A")
    assert effective_org_id(sess) == "org-a"


def test_impersonating_admin_resolves_to_the_customer_org() -> None:
    sess = _principal(
        platform_role="platform_admin",
        session_org_id=None,
        acting_org_id="org-customer",
        acting_org_name="Customer",
        acting_expires_at=datetime.now(UTC) + timedelta(minutes=30),
    )
    assert effective_org_id(sess) == "org-customer"
    assert sess.acting() is not None


def test_expired_impersonation_falls_back() -> None:
    sess = _principal(
        platform_role="platform_admin",
        session_org_id="org-own",
        org_name="Own",
        acting_org_id="org-customer",
        acting_org_name="Customer",
        acting_expires_at=datetime.now(UTC) - timedelta(seconds=1),
    )
    assert effective_org_id(sess) == "org-own"
    assert sess.acting() is None


def test_a_demoted_operator_stops_impersonating() -> None:
    """The chrome and the data scope must not disagree about this."""
    sess = _principal(
        platform_role=None,  # demoted while holding the session
        acting_org_id="org-customer",
        acting_org_name="Customer",
        acting_expires_at=datetime.now(UTC) + timedelta(minutes=30),
    )
    assert sess.acting() is None
    assert effective_org_id(sess) is None


def test_naive_expiry_timestamps_are_treated_as_utc() -> None:
    sess = _principal(
        platform_role="platform_admin",
        acting_org_id="org-customer",
        acting_org_name="Customer",
        acting_expires_at=(datetime.now(UTC) + timedelta(minutes=5)).replace(tzinfo=None),
    )
    assert effective_org_id(sess) == "org-customer"


def test_nothing_outside_accounts_reads_the_raw_session_org() -> None:
    """The guard that will actually catch the first module author.

    `session_org_id` is named awkwardly so this test has something to grep for.
    If it fails, use effective_org_id() instead of the field.
    """
    offenders = []
    for path in list(SRC.rglob("*.py")) + list((REPO / "modules").rglob("*.py")):
        if path.name == "accounts.py":
            continue
        text = path.read_text()
        if re.search(r"\bsession_org_id\b", text):
            offenders.append(str(path.relative_to(REPO)))
    assert not offenders, (
        f"{offenders} read session_org_id directly. That ignores impersonation — "
        "call accounts.effective_org_id(sess) instead."
    )
