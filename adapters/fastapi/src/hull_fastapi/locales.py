"""Which languages exist, and how the server picks one.

The list is **generated**. `packages/i18n` writes `locales.json` beside this
file, the same way it writes the mail bodies into `mail_templates/`, because a
tuple here beside the one in `packages/i18n/src/locales.ts` is two sources of
truth for the same fact — and the drift is silent: a locale missing from the
Python copy just quietly stops being offered.

The negotiation *algorithm* is duplicated, and that is a considered trade. The
alternative is for the browser to send its own answer at signup, which removes
the duplication and costs more than it saves: the welcome mail goes out inside
that request, so any client that forgets the field sends a Portuguese reader an
English mail, silently. The header is already in the request. Twenty lines of
RFC 4647 lookup, with the same cases asserted on both sides, is the cheaper
half. → ADR-0016
"""

from __future__ import annotations

import json
from functools import cache
from pathlib import Path

MANIFEST = Path(__file__).with_name("locales.json")


@cache
def _manifest() -> dict:
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def locales() -> tuple[str, ...]:
    return tuple(_manifest()["locales"])


def default_locale() -> str:
    return str(_manifest()["default"])


def is_locale(value: object) -> bool:
    return isinstance(value, str) and value in locales()


def resolve(value: str | None) -> str:
    """What to store for a locale somebody sent us.

    Unknown tags fall back rather than raising: this arrives from a browser and
    from `PATCH /v1/me`, and refusing a signup because the reader's language is
    not one we speak would be an odd way to say "we only have English".
    """
    return value if is_locale(value) else default_locale()


def negotiate(accept_language: str | None) -> str:
    """The best of ours for an `Accept-Language` header.

    Exact match first, then by base language — `pt`, `pt-PT` and `pt-br` all land
    on `pt-BR`, the only Portuguese we have. Serving a Portuguese reader
    Brazilian Portuguese is a small wrong; serving them English is a bigger one.
    """
    tags = _wanted(accept_language)
    available = locales()
    for tag in tags:
        for one in available:
            if one.lower() == tag:
                return one
    for tag in tags:
        base = tag.split("-")[0]
        for one in available:
            if one.lower().split("-")[0] == base:
                return one
    return default_locale()


def _wanted(header: str | None) -> list[str]:
    """Lowercased tags, best first.

    `*` is dropped: it means "anything", which is what the fallback already is.
    A malformed q-value scores 0 and is dropped with it — a header we cannot read
    is not a preference.
    """
    if not header:
        return []
    scored: list[tuple[float, int, str]] = []
    for index, part in enumerate(header.split(",")):
        tag, _, params = part.strip().partition(";")
        tag = tag.strip().lower()
        if not tag or tag == "*":
            continue
        q = 1.0
        for param in params.split(";"):
            param = param.strip()
            if param.startswith("q="):
                try:
                    q = float(param[2:])
                except ValueError:
                    q = 0.0
        if q > 0:
            # index keeps the header's own order inside equal weights.
            scored.append((-q, index, tag))
    return [tag for _, _, tag in sorted(scored)]
