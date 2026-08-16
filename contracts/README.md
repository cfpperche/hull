# Contracts

`openapi.yaml` is the host HTTP contract. Cookie session, problem+json, User + Org.

A second backend lives under `adapters/<name>/` and implements this file against `schema/`. Do not generate this from FastAPI and treat the framework as source.

The TypeScript client in `packages/api-client` should stay aligned with this file.
