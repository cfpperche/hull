from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from hull_api.config import Settings

log = logging.getLogger("hull_api.mail")


def send_mail(settings: Settings, *, to: str, subject: str, text: str) -> str:
    msg = EmailMessage()
    msg["From"] = settings.mail_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
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
