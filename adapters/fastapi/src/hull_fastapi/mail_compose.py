"""Turn a rendered template into a message.

The templates are built by `packages/email` — react-email JSX, rendered once to
the static HTML and text in `mail_templates/`, with `{{name}}` where a value
goes. React is not in the request path and never sees a real address: putting
Node behind SMTP would mean a second runtime in the compose group for six
transactional messages. This module is the other half — it loads those files and
fills the holes.

Editing an email means editing the JSX and running
`pnpm --filter @hull/email build`, which rewrites `mail_templates/`. Do not edit
those files by hand; `pnpm --filter @hull/email check` fails the build if they
have drifted from the JSX.

Rebranding is still a restart, not a rebuild: the name, the mark and the host all
arrive from Settings, which is where white-label values already live (ADR-0006).
Only the design is fixed.
"""

from __future__ import annotations

import logging
import re
from functools import cache
from html import escape
from pathlib import Path

from hull_fastapi.accounts import EMAIL_CHANGE_TTL, RESET_TTL, VERIFY_TTL
from hull_fastapi.config import Settings

log = logging.getLogger("hull.mail")

TEMPLATES = Path(__file__).with_name("mail_templates")
_HOLE = re.compile(r"\{\{\s*([a-z_]+)\s*\}\}")

# Whole numbers, formatted once from the TTLs the tokens actually expire on.
# Read from accounts so a change to the TTL cannot leave the copy claiming
# something the token no longer does.
RESET_MINUTES = int(RESET_TTL.total_seconds() // 60)
VERIFY_DAYS = VERIFY_TTL.days
CHANGE_HOURS = int(EMAIL_CHANGE_TTL.total_seconds() // 3600)


@cache
def _raw(key: str, suffix: str) -> str:
    return (TEMPLATES / f"{key}.{suffix}").read_text(encoding="utf-8")


def _fill(body: str, values: dict[str, str], *, as_html: bool) -> str:
    """Replace every `{{name}}` with its value.

    Escaped for the HTML half, raw for the text half. The values are addresses
    and a brand string out of `.env` — none is trusted enough to be interpolated
    into markup unescaped, and an address is allowed characters that would
    otherwise close a tag.
    """

    def one(match: re.Match[str]) -> str:
        name = match.group(1)
        if name not in values:
            return match.group(0)
        value = values[name]
        return escape(value, quote=True) if as_html else value

    filled = _HOLE.sub(one, body)
    leftover = sorted(set(_HOLE.findall(filled)))
    if leftover:
        # Deliberately not an exception. A reset mail that goes out with a
        # visible `{{brand}}` is embarrassing; one that does not go out at all
        # costs somebody their account. The tests assert this list is empty for
        # every message, which is where it should be caught.
        log.warning("mail template left unfilled: %s", ", ".join(leftover))
    return filled


def _compose(settings: Settings, key: str, values: dict[str, str]) -> tuple[str, str]:
    """Returns (text, html). Text first, because it is the required half."""
    common = {
        "brand": settings.resolved_brand(),
        "mark": settings.resolved_mark(),
        "host": settings.host,
    }
    merged = {**common, **values}
    return (
        _fill(_raw(key, "txt"), merged, as_html=False),
        _fill(_raw(key, "html"), merged, as_html=True),
    )


def welcome(settings: Settings, *, verify_link: str | None) -> tuple[str, str]:
    """Signup. One mail, not two — the welcome carries the confirmation link,
    because a welcome and a separate "confirm your address" arriving together is
    the pair people learn to ignore."""
    if not verify_link:
        return _compose(settings, "welcome", {})
    return _compose(
        settings,
        "welcome-verify",
        {"link": verify_link, "verify_days": str(VERIFY_DAYS)},
    )


def password_reset(settings: Settings, *, link: str) -> tuple[str, str]:
    return _compose(settings, "password-reset", {"link": link, "reset_minutes": str(RESET_MINUTES)})


def verify_email(settings: Settings, *, link: str) -> tuple[str, str]:
    return _compose(settings, "verify-email", {"link": link, "verify_days": str(VERIFY_DAYS)})


def email_change_confirm(settings: Settings, *, link: str, old_email: str) -> tuple[str, str]:
    return _compose(
        settings,
        "email-change-confirm",
        {"link": link, "old_email": old_email, "change_hours": str(CHANGE_HOURS)},
    )


def email_change_notice(settings: Settings, *, old_email: str, new_email: str) -> tuple[str, str]:
    return _compose(
        settings, "email-change-notice", {"old_email": old_email, "new_email": new_email}
    )


def email_changed(settings: Settings, *, old_email: str, new_email: str) -> tuple[str, str]:
    return _compose(settings, "email-changed", {"old_email": old_email, "new_email": new_email})
