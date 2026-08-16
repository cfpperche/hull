# Hull — agent notes

Standalone SaaS hull. Not a product. Not Opt.

Read `README.md` first. The host ritual is `scripts/setup-local.sh` then `scripts/up.sh`.

Update `CHANGELOG.md` under `[Unreleased]` before every push to `main`.

## Locks

- Frontend: Vite + React + Tailwind 4 + shadcn **default**. No Next.js. No custom token sheet.
- Schema: SQL in `schema/`. Migrate with `scripts/migrate.sh` (psql). Do not put DDL in FastAPI.
- HTTP contract: `contracts/openapi.yaml`. FastAPI in `api/` is one adapter. A second language implements the same file.
- Do not add a database microservice. Postgres is the store. The API talks to it.
- Objects: User (login) and Org (workspace). Do not add Company/Store unless a product module needs a second level.
- Edge: Traefik **inside** `deploy/compose.yaml`. Do not join an external Docker network.
- Compose project name is **`hull`**. Every container is `docker compose -p hull`. Never `docker run` a Hull process — VS Code files it under Individual Containers.
- Hosts: `*.dev` (default `hull.dev`). Not `.test`.
- Signup: username + email + password. Then one workspace name. No long wizard.
- Chrome: Vercel / Linear / Supabase density. Confirm writes (toast, destination, or control state). No Inter+purple.

## Surfaces

| App | Host | Auth |
|---|---|---|
| `apps/www` | `hull.dev` | none |
| `apps/web` | `app.hull.dev` | cookie |
| `apps/admin` | `admin.hull.dev` | `platform_admin` |

Support impersonates an **org**. Do not mint the customer’s session.

## Do not

- Add a worker, Redis, or Grafana unless a product module requires it.
- Observe is JSON stdout + `install_events`. No collector required.
- Do not put product domain in `packages/ui` or `api/` auth.
