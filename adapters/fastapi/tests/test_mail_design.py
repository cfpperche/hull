"""What the mail looks like, and what it must never contain.

The bodies are built by `packages/email` — react-email JSX rendered once into
`hull_fastapi/mail_templates/` — and filled in by `mail_compose`. React is not in
the request path, so nothing here renders JSX; these read the artefact the build
produced and the message the adapter makes out of it.

The guards worth having are all about the seam between the two halves: a hole the
adapter forgot to fill is delivered literally, and a value dropped into HTML
unescaped is markup.
"""

from __future__ import annotations

import re
import smtplib

import pytest

from hull_fastapi import mail_compose
from hull_fastapi.config import Settings
from hull_fastapi.mail import send_mail

LINK = "https://app.hull.test/reset#tok-abc123"
OLD = "old@hull.test"
NEW = "new@hull.test"

HOLE = re.compile(r"\{\{\s*[a-z_]+\s*\}\}")


@pytest.fixture
def s() -> Settings:
    return Settings(brand="Hull", mark="", host="hull.test", smtp_host="", database_url="x")


def _all_messages(s: Settings) -> dict[str, tuple[str, str]]:
    return {
        "welcome": mail_compose.welcome(s, verify_link=None),
        "welcome-verify": mail_compose.welcome(s, verify_link=LINK),
        "password-reset": mail_compose.password_reset(s, link=LINK),
        "verify-email": mail_compose.verify_email(s, link=LINK),
        "email-change-confirm": mail_compose.email_change_confirm(s, link=LINK, old_email=OLD),
        "email-change-notice": mail_compose.email_change_notice(s, old_email=OLD, new_email=NEW),
        "email-changed": mail_compose.email_changed(s, old_email=OLD, new_email=NEW),
    }


def test_every_message_fills_every_hole(s: Settings) -> None:
    """The one that matters.

    A `{{link}}` the adapter does not know about survives substitution and is
    delivered as those eight characters, in the mail whose only job is to carry a
    URL. The build refuses an *unknown* placeholder; this refuses a known one
    nobody passed a value for.
    """
    for key, (text, html) in _all_messages(s).items():
        assert not HOLE.search(text), f"{key}.txt kept {HOLE.findall(text)}"
        assert not HOLE.search(html), f"{key}.html kept {HOLE.findall(html)}"


def test_both_halves_carry_the_link(s: Settings) -> None:
    """A text-only client is not a second-class reader. Whatever the button says,
    the URL has to be readable without one."""
    for key in ("welcome-verify", "password-reset", "verify-email", "email-change-confirm"):
        text, html = _all_messages(s)[key]
        assert LINK in text, f"{key}.txt has no usable link"
        assert LINK in html, f"{key}.html has no usable link"


def test_the_brand_is_not_baked_in(s: Settings) -> None:
    """White-label reaches the mail too (ADR-0006). The design is fixed; the name
    is not."""
    other = Settings(brand="Acme", mark="", host="acme.test", database_url="x")
    text, html = mail_compose.password_reset(other, link=LINK)
    assert "Acme" in text and "Acme" in html
    assert "acme.test" in text and "acme.test" in html
    assert "Hull" not in html


def test_values_are_escaped_into_the_html_and_raw_in_the_text() -> None:
    """An address is allowed characters that close a tag. The text half must keep
    them exactly, and the html half must not."""
    hostile = 'a"><script>alert(1)</script>@hull.test'
    s = Settings(brand="Hull", mark="", host="hull.test", database_url="x")
    text, html = mail_compose.email_changed(s, old_email=hostile, new_email=NEW)
    assert hostile in text
    assert "<script>" not in html
    assert "&lt;script&gt;" in html


def test_the_html_uses_nothing_a_mail_client_would_drop(s: Settings) -> None:
    """oklch() and custom properties are how the product states its colours and
    exactly what Gmail and Outlook discard, leaving unstyled text. A remote image
    is worse — blocked by default, so the brand arrives as a broken icon."""
    for key, (_text, html) in _all_messages(s).items():
        assert "oklch(" not in html, f"{key} carries a colour function no client parses"
        assert "var(--" not in html, f"{key} carries a custom property"
        assert "<script" not in html.lower(), f"{key} carries a script"
        assert "<link" not in html.lower(), f"{key} carries an external stylesheet"
        # The only absolute URLs are the ones we mint and print on purpose.
        for url in re.findall(r'(?:src|background)\s*=\s*"(https?://[^"]+)"', html):
            raise AssertionError(f"{key} fetches a remote asset: {url}")


def test_the_two_warnings_have_no_button(s: Settings) -> None:
    """Both go to somebody who may not have asked for anything. A one-click action
    in a "was this you?" mail teaches the reflex phishing depends on."""
    for key in ("email-change-notice", "email-changed"):
        _text, html = _all_messages(s)[key]
        assert "href=" not in html, f"{key} offers something to click"


def test_a_message_is_multipart_with_text_first(monkeypatch) -> None:
    """Order is the specification: a client takes the last part it understands.
    Reversed, every text-only reader would get the HTML source."""
    captured = []

    class FakeSMTP:
        def __init__(self, *a, **k) -> None:
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a) -> None:
            return None

        def send_message(self, msg) -> None:
            captured.append(msg)

    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
    s = Settings(brand="Hull", mark="", host="hull.test", smtp_host="mail", database_url="x")
    text, html = mail_compose.password_reset(s, link=LINK)
    assert send_mail(s, to="a@hull.test", subject="Reset", text=text, html=html) == "sent"

    msg = captured[0]
    assert msg.get_content_type() == "multipart/alternative"
    parts = [p.get_content_type() for p in msg.iter_parts()]
    assert parts == ["text/plain", "text/html"]


def test_a_subject_cannot_smuggle_a_header(monkeypatch) -> None:
    """A newline in a subject is an SMTP header injection, and subjects are built
    from values that came from somewhere."""
    captured = []

    class FakeSMTP:
        def __init__(self, *a, **k) -> None:
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a) -> None:
            return None

        def send_message(self, msg) -> None:
            captured.append(msg)

    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
    s = Settings(brand="Hull", mark="", host="hull.test", smtp_host="mail", database_url="x")
    send_mail(s, to="a@hull.test", subject="Reset\r\nBcc: sneak@evil.test", text="hi")
    assert captured[0]["Subject"] == "Reset Bcc: sneak@evil.test"
    assert captured[0]["Bcc"] is None


def test_text_only_still_sends(monkeypatch) -> None:
    """html is an alternative, never a requirement — a caller that passes only
    text must still produce a valid single-part message."""
    captured = []

    class FakeSMTP:
        def __init__(self, *a, **k) -> None:
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a) -> None:
            return None

        def send_message(self, msg) -> None:
            captured.append(msg)

    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
    s = Settings(brand="Hull", mark="", host="hull.test", smtp_host="mail", database_url="x")
    send_mail(s, to="a@hull.test", subject="Plain", text="just text")
    assert captured[0].get_content_type() == "text/plain"
