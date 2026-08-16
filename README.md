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

Change the apex with `HULL_HOST` in `.env` and re-run setup. Default is **`.dev`**, not `.test`.

## What this is

- User + org. Signup is username, email, password. Then one workspace name.
- Cookie session. Isolation is `org_id`.
- Support “view as” an org without minting the owner’s session.
- Same artifacts for a laptop and a self-host box. Traefik lives **in this compose project** and binds `127.0.0.1:80` and `:443`. It does not join any other network.

## Stack

| Layer | Choice |
|---|---|
| Product / admin / www | Vite + React 19 + Tailwind 4 + shadcn default |
| API | FastAPI (uv), Postgres 16 |
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
| `./scripts/build-images.sh` | `hull-api` `hull-www` `hull-web` `hull-admin` |

80/443 on loopback must be free (or already owned by `hull-traefik`).

## Layout

```text
apps/www          marketing
apps/web          signed-in product
apps/admin        platform / support
packages/ui       ProductShell + shadcn
packages/api-client
api/              FastAPI
deploy/           compose, Traefik, nginx, certs
modules/example   empty product slot
scripts/          the ritual above
```

A future product is a module. The hull does not know what it sells.
