# 0003. Openapi yaml is the contract

**Status:** Accepted  
**Date:** 2026-08-16

## Context

`adapters/fastapi/` is the default implementation, not the definition. Without a
written contract the implementation becomes the spec by default, and a second adapter
has nothing to build against.

## Decision

`contracts/openapi.yaml` is the contract; adapters implement it. The adapter publishes
no generated spec - `docs_url`, `redoc_url` and `openapi_url` are disabled - so there
is exactly one document.

## Consequences

The contract must describe what the adapter actually does, including the `problem+json`
error model and its `reason_code` vocabulary. When they disagree, the contract is
wrong, not the code. Auth is expressed with `security` so a generated stub inherits it
instead of shipping unguarded admin routes.
