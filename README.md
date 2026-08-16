# Hull

Standalone **app shell + chrome** for a SaaS. No product attached.

Clone the repo. Install Docker (Compose v2) and openssl. The scripts create certificates, write `/etc/hosts`, trust the project CA, build images, and start the stack. Nothing else on the machine is required for `./scripts/up.sh`.

```text
git clone https://github.com/cfpperche/hull.git
cd hull
cp .env.example .env
sudo ./scripts/setup-local.sh
./scripts/up.sh
./scripts/smoke.sh
```

| Host | Surface |
|---|---|
| https://hull.dev/ | Marketing (`apps/www`) |
| https://app.hull.dev/ | Product (`apps/web`) |
| https://admin.hull.dev/ | Install operator (`apps/admin`) |
| https://mail.hull.dev/ | Mailpit |
| https://s3.hull.dev/ | Object store API |
| https://rustfs.hull.dev/ | Object store console |

Lab logins after seed: `ada@hull.dev` / `demodemo1` (owner of one workspace). `admin@hull.dev` / `demodemo1` (platform admin, no workspace).

Change the apex and chrome with `.env` (`HULL_HOST`, `HULL_BRAND`, `HULL_MARK`, `HULL_COOKIE_NAME`). Re-run `setup-local.sh` when the host changes. Default TLD is **`.dev`**, not `.test`. SPA images do not bake the host — `scripts/render-brand.sh` writes `/config.json` at start. Compose project stays **`hull`**. Two installs on one daemon need a different `HULL_BIND` / Postgres port (not in this ritual).

## What this is

- User + org. Signup is username, email, password. Then one workspace name.
- Cookie session. Isolation is `org_id`.
- Support “view as” an org without minting the owner’s session.
- Same artifacts for a laptop and a self-host box. Traefik lives **in this compose project** and binds `127.0.0.1:80` and `:443`. It does not join any other network.

## Stack

| Layer | Choice |
|---|---|
| Product / admin / www | Vite + React 19 + Tailwind 4 + shadcn default |
| Schema | Postgres 16 — SQL in `schema/`, applied by `scripts/migrate.sh` |
| HTTP contract | `contracts/openapi.yaml` |
| API adapter | FastAPI (uv) — replaceable |
| Objects | RustFS (S3) |
| Mail | Mailpit |
| Edge | Traefik v3 + project CA |

No Next.js. No worker. No billing. No SSO.

## Commands

| Script | Does |
|---|---|
| `./scripts/setup-local.sh` | Certs, `/etc/hosts`, trust CA (sudo, once) |
| `./scripts/up.sh` | Build missing images, migrate, start the block |
| `./scripts/smoke.sh` | www + health + signup + org isolation |
| `./scripts/down.sh` | Stop. `./scripts/down.sh -v` wipes volumes |
| `./scripts/dev.sh` | Data plane + edge; API and Vite stay on the host |
| `./scripts/test.sh` | Disposable Postgres + pytest |
| `./scripts/render-brand.sh` | `/config.json` from `.env` (chrome + host) |
| `./scripts/build-images.sh` | `hull-api` `hull-www` `hull-web` `hull-admin` |

80/443 on loopback must be free (or already owned by `hull-traefik`).

Compose project name is **`hull`**. Docker Desktop / VS Code Containers shows one folder, like Opt and CognixSE. Pytest Postgres is `testdb` (`--profile test`) in that same group. Do not `docker run` Hull containers.

Changelog: [`CHANGELOG.md`](CHANGELOG.md). Update `[Unreleased]` before pushing `main`.

## Layout

```text
schema/           Postgres (migrations + lab seed). Not Python.
contracts/        OpenAPI. The host HTTP contract.
apps/www          marketing
apps/web          signed-in product
apps/admin        platform / support
packages/ui       ProductShell + shadcn
packages/api-client
api/              FastAPI adapter — implements contracts/ against schema/
deploy/           compose, Traefik, nginx, certs
modules/example   empty product slot
scripts/          setup, migrate, up, smoke
CHANGELOG.md      Keep a Changelog — update before push
```

A future product is a module. The hull does not know what it sells.
