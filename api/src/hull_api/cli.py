from __future__ import annotations

import os

import uvicorn

from hull_api.config import Settings
from hull_api.db import apply_migrations
from hull_api.observe import configure_logging
from hull_api.storage import ensure_buckets, s3_enabled


def api_main() -> None:
    configure_logging()
    settings = Settings()
    if s3_enabled(settings):
        ensure_buckets(settings)
    from hull_api.api import create_app

    app = create_app(settings)
    uvicorn.run(app, host=settings.api_host, port=settings.api_port, proxy_headers=True)


def migrate_main() -> None:
    configure_logging()
    settings = Settings()
    seed = os.environ.get("HULL_SEED_DEMO", "1") == "1"
    apply_migrations(settings, seed=seed)


def seed_main() -> None:
    configure_logging()
    apply_migrations(Settings(), seed=True)
