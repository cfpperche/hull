from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

from hull_api.config import Settings


@contextmanager
def connection(settings: Settings) -> Iterator[psycopg.Connection]:
    conn = psycopg.connect(settings.database_url, row_factory=dict_row, autocommit=False)
    try:
        yield conn
    finally:
        conn.close()


def apply_migrations(settings: Settings) -> None:
    root = Path(settings.migrations_dir) if settings.migrations_dir else Path(__file__).resolve().parents[2] / "migrations"
    files = sorted(root.glob("*.sql"))
    with psycopg.connect(settings.database_url, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    id TEXT PRIMARY KEY,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
                """
            )
            cur.execute("SELECT id FROM schema_migrations")
            done = {row[0] for row in cur.fetchall()}
            for path in files:
                if path.name in done:
                    continue
                cur.execute(path.read_text())
                cur.execute("INSERT INTO schema_migrations (id) VALUES (%s)", (path.name,))
