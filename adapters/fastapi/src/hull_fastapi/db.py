from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row

from hull_fastapi.config import Settings


@contextmanager
def connection(settings: Settings) -> Iterator[psycopg.Connection]:
    conn = psycopg.connect(settings.database_url, row_factory=dict_row, autocommit=False)
    try:
        yield conn
    finally:
        conn.close()


# Migrations are not this adapter's job. SQL lives in schema/ and is applied by
# scripts/migrate.sh — see AGENTS.md ("Do not put DDL in FastAPI"). A second
# runner here would drift from the bash one and the test suite would hide it.
