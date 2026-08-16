# Contracts

`openapi.yaml` is the host HTTP contract. Cookie session, problem+json, User + Org.

A second backend replaces `api/` (the FastAPI adapter) by implementing this file against `schema/`. Do not generate this from FastAPI and treat the framework as source.

The TypeScript client in `packages/api-client` should stay aligned with this file.
