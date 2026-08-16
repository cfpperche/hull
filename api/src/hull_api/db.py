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


def schema_root(settings: Settings) -> Path:
    if settings.schema_dir:
        return Path(settings.schema_dir)
    return Path(__file__).resolve().parents[3] / "schema"


def _apply_sql_dir(cur, table: str, directory: Path) -> None:
    cur.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {table} (
            id TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    cur.execute(f"SELECT id FROM {table}")
    done = {row[0] for row in cur.fetchall()}
    for path in sorted(directory.glob("*.sql")):
        if path.name in done:
            continue
        cur.execute(path.read_text())
        cur.execute(f"INSERT INTO {table} (id) VALUES (%s)", (path.name,))


def _apply_seed_tmpls(cur, directory: Path, host: str) -> None:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_seeds (
            id TEXT PRIMARY KEY,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    cur.execute("SELECT id FROM schema_seeds")
    done = {row[0] for row in cur.fetchall()}
    safe_host = host.replace("'", "''")
    for path in sorted(directory.glob("*.sql.tmpl")):
        ident = path.name.removesuffix(".tmpl")
        if ident in done:
            continue
        cur.execute(path.read_text().replace("__HOST__", safe_host))
        cur.execute("INSERT INTO schema_seeds (id) VALUES (%s)", (ident,))


def apply_migrations(settings: Settings, *, seed: bool = False) -> None:
    root = schema_root(settings)
    with psycopg.connect(settings.database_url, autocommit=True) as conn:
        with conn.cursor() as cur:
            _apply_sql_dir(cur, "schema_migrations", root / "migrations")
            if seed:
                _apply_sql_dir(cur, "schema_seeds", root / "seed")
                _apply_seed_tmpls(cur, root / "seed", settings.host)
