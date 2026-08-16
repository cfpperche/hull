from __future__ import annotations

import json
import logging
import sys
import uuid
from datetime import UTC, datetime
from typing import Any

import psycopg


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        body: dict[str, Any] = {
            "ts": datetime.now(UTC).isoformat(),
            "level": record.levelname.lower(),
            "logger": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            body["exc"] = self.formatException(record.exc_info)
        return json.dumps(body, default=str)


def configure_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.INFO)


def record_event(
    conn: psycopg.Connection,
    *,
    source: str,
    event: str,
    level: str = "info",
    org_id: str | None = None,
    payload: dict[str, Any] | None = None,
) -> None:
    try:
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO install_events (id, source, event, level, org_id, payload)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (str(uuid.uuid4()), source, event, level, org_id, json.dumps(payload or {})),
                )
    except Exception:
        logging.getLogger("hull_api.observe").warning("event write failed", exc_info=True)
