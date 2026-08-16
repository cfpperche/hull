# Adapters

The HTTP contract is `contracts/openapi.yaml`. The data contract is `schema/`.

This directory holds **implementations**. Compose service `api` is the process slot (port `/api`). Swap the image; do not rename the slot.

| Path | Language | Binary |
|---|---|---|
| `fastapi/` | Python / FastAPI | `hull-fastapi` (also `hull-api` for the slot) |

A second adapter implements the same OpenAPI against the same SQL. Do not put schema or OpenAPI here.
