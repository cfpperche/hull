# Hull handoff

**Date:** 2026-08-16  
**Repo:** `https://github.com/cfpperche/hull` (public)  
**Workspace:** `/home/goat/hull`

Start of session: read this, then `AGENTS.md`.

## What it is

Standalone app shell + chrome. Vite + React + shadcn default + FastAPI adapter. User + Org. White-label **values** in `.env`. Compose project `hull`. Default host **`hull.test`**.

## Up

```bash
cd /home/goat/hull
sudo ./scripts/setup-local.sh    # Linux hosts+CA; WSL also Windows UAC
./scripts/up.sh
./scripts/smoke.sh
```

Lab: `ada@hull.test` / `demodemo1`. Admin: `admin@hull.test` / `demodemo1`.

This workstation: Hull binds `127.0.0.1:80` and `:443`. Postgres is published on `:55435` when `:5432` is already taken. Another compose project on the same edge must be down first.

## Shipped

- Three surfaces: www / web / admin
- Schema in `schema/`, OpenAPI in `contracts/`, default adapter in `adapters/fastapi/`, migrate via `scripts/migrate.sh`
- Windows + WSL hosts/CA (`setup-windows-from-wsl.sh`)
- `scripts/prune.sh` — no leftover migrate/testdb in the compose group
- Agent files + visual harness (agent-browser)
- First visual pass: `@source` for `@hull/ui`, desktop rail, auth frame, quiet empty home

## Next (not started)

- Dogfood skill (browser signup) if the visual loop is stable
- Product module in `modules/` when there is a sold job

## Later — component lab (do not do now)

When `@hull/ui` has a real catalog (Shell, Button states, empty, toast) **then** add Storybook and consider **Chromatic** for component visual regression on PRs.

Until then: agent-browser + PNG judgment. After a look we like: `agent-browser diff screenshot --baseline` locally. Not Chromatic on full pages.

## Do not rebuild

Auth, cookie, org isolation, Traefik-in-compose, `config.json` runtime brand.
