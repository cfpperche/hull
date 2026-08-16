from __future__ import annotations

import uvicorn

from hull_fastapi.config import Settings
from hull_fastapi.observe import configure_logging
from hull_fastapi.storage import ensure_buckets, s3_enabled

# AGENTS.md: observability is JSON on stdout. Without this uvicorn emits its own
# startup and access lines through its plain-text formatters, so the container's
# stdout was a mix and `docker logs hull-api | jq` choked on the first record.
LOG_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"json": {"()": "hull_fastapi.observe.JsonFormatter"}},
    "handlers": {
        "stdout": {
            "class": "logging.StreamHandler",
            "stream": "ext://sys.stdout",
            "formatter": "json",
        }
    },
    "loggers": {
        "uvicorn": {"handlers": ["stdout"], "level": "INFO", "propagate": False},
        "uvicorn.error": {"handlers": ["stdout"], "level": "INFO", "propagate": False},
        "uvicorn.access": {"handlers": ["stdout"], "level": "INFO", "propagate": False},
    },
}


def api_main() -> None:
    configure_logging()
    settings = Settings()
    if s3_enabled(settings):
        ensure_buckets(settings)
    from hull_fastapi.api import create_app

    app = create_app(settings)
    # The API is only reachable through Traefik on the internal compose network,
    # which dials from a bridge IP — uvicorn's default only trusts 127.0.0.1, so
    # without this the forwarded proto/host headers are silently dropped.
    uvicorn.run(
        app,
        host=settings.api_host,
        port=settings.api_port,
        proxy_headers=True,
        forwarded_allow_ips="*",
        log_config=LOG_CONFIG,
    )
