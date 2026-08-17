from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from hull_fastapi.config import Settings

log = logging.getLogger("hull_fastapi.mail")


def send_mail(
    settings: Settings, *, to: str, subject: str, text: str, html: str | None = None
) -> str:
    """Send one message. `text` is required; `html` is an alternative, never a
    replacement.

    multipart/alternative, in that order, because the order is the specification:
    a client picks the last part it understands. Sending HTML alone would mean a
    text-only reader gets nothing at all, and it is the plain part that carries
    deliverability — a reset link that lands in spam has failed.
    """
    msg = EmailMessage()
    msg["From"] = settings.resolved_mail_from()
    msg["To"] = to
    # A newline in a subject is an SMTP header injection. The stdlib already
    # refuses one — it raises rather than writing the header — so this is not
    # what stands between us and an injected Bcc. What it buys is the difference
    # between a delivered message and a 500: a brand string out of `.env` with a
    # stray newline in it would otherwise take down every mail the install sends.
    msg["Subject"] = " ".join(subject.split())
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")
    host = (settings.smtp_host or "").strip()
    if not host:
        log.info("mail skipped to=%s subject=%s", to, subject)
        return "skipped"
    try:
        with smtplib.SMTP(host, settings.smtp_port, timeout=5) as smtp:
            smtp.send_message(msg)
        return "sent"
    except OSError as exc:
        log.warning("mail send failed to=%s: %s", to, exc)
        return "failed"
