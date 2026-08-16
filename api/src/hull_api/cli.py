from __future__ import annotations

import os

import uvicorn

from hull_api.config import Settings
from hull_api.db import apply_migrations
from hull_api.observe import configure_logging
from hull_api.seed import seed_demo
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
    apply_migrations(settings)
    if settings.seed_demo or os.environ.get("HULL_SEED_DEMO") == "1":
        seed_demo(settings)


def seed_main() -> None:
    configure_logging()
    seed_demo(Settings())
