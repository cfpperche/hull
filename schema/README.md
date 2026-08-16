# Schema

Postgres is the durable contract. The HTTP API is not.

Any backend (this repo’s FastAPI, or Go / Bun later) reads and writes these tables. Isolation key is `org_id`. Do not add FastAPI, ORMs, or Python types here.

| Path | Role |
|---|---|
| `migrations/` | Forward-only SQL. Applied by `scripts/migrate.sh` (psql). |
| `seed/*.sql.tmpl` | Lab fixtures. `__HOST__` becomes `HULL_HOST`. Idempotent. |

`scripts/migrate.sh` is the runner. It is bash + `psql`. It does not import the API package.

The HTTP contract lives in `contracts/openapi.yaml`. Implement that; do not treat `api/` as the schema.
