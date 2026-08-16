from __future__ import annotations

import uvicorn

from hull_fastapi.config import Settings
from hull_fastapi.observe import configure_logging
from hull_fastapi.storage import ensure_buckets, s3_enabled


def api_main() -> None:
    configure_logging()
    settings = Settings()
    if s3_enabled(settings):
        ensure_buckets(settings)
    from hull_fastapi.api import create_app

    app = create_app(settings)
    uvicorn.run(app, host=settings.api_host, port=settings.api_port, proxy_headers=True)
