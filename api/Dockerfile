# syntax=docker/dockerfile:1.7
FROM public.ecr.aws/docker/library/python:3.12-slim-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.7.12 /uv /usr/local/bin/uv

WORKDIR /src
COPY pyproject.toml uv.lock /src/
COPY src /src/src
COPY migrations /src/migrations

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy
RUN uv sync --frozen --no-dev

ENV PATH="/src/.venv/bin:$PATH" \
    HULL_MIGRATIONS_DIR=/src/migrations \
    HULL_API_HOST=0.0.0.0 \
    HULL_ROOT_PATH=/api

WORKDIR /src
EXPOSE 8080
CMD ["hull-api"]
