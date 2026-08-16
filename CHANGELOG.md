# Changelog

All notable changes to Hull. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

> **Update this file before every push to `main`.** Add entries under `[Unreleased]`
> using the categories below. Write for someone who was not in the session: what
> changed and why it mattered, not which files you touched — the diff already knows that.
>
> Categories: `Added` · `Changed` · `Deprecated` · `Removed` · `Fixed` · `Security`
>
> When a version ships, rename `[Unreleased]` to `[x.y.z] — YYYY-MM-DD` and open a fresh
> `[Unreleased]` above it.

---

## [Unreleased]

### Fixed

- `up` no longer leaves `hull-migrate` Exited in the VS Code group (`migrate` is profile `tools`; `compose run --rm`). `test.sh` removes `hull-test-pg` after pytest. `scripts/prune.sh` clears those leftovers.

### Added

- Agent kit: `AGENTS.md` (single source), `CLAUDE.md` / `GROK.md` / `CODEX.md` pointers, `HANDOFF.md`, `harness/orchestration.md`, `harness/benchmarks.md`.
- Visual harness on **agent-browser** (not Playwright): `harness/scripts/capture-ui.sh`, `harness/visual-ux.md`, `.grok/skills/visual-ux`. Chromatic deferred until `@hull/ui` is a Storybook catalog.

- Windows + WSL setup: `setup-windows.ps1` + `setup-windows-from-wsl.sh`. `setup-local.sh` on WSL opens UAC and writes Windows `hosts` + trusts the project CA (same ritual as Opt). Chrome on Windows does not use the WSL `/etc/hosts`.

### Changed

- Default host is **`hull.test`**. `.dev` is a public gTLD (`hull.dev` resolves on the internet, HSTS preload). `.local` is reserved for mDNS — do not use it.

### Added

- White-label **values** in `.env`: `HULL_BRAND`, `HULL_MARK`, `HULL_COOKIE_NAME`, plus existing `HULL_HOST`. `scripts/render-brand.sh` writes `/config.json` at start (no SPA rebuild). Chrome, mail subject/from, and lab seed emails follow those values.
- Lab seed template `schema/seed/001_lab.sql.tmpl` (`ada@` + host).
- Compose `testdb` (`profile: test`) so pytest Postgres lives in the **hull** group in Docker Desktop / VS Code Containers.
- Labels `hull.project` / `hull.role` on every service, same grouping contract as Opt.

### Changed

- SPA images no longer bake `VITE_HULL_HOST`. Nginx mounts `deploy/brand/config.json`.
- Mail from defaults to `{brand} <noreply@{host}>` when `HULL_MAIL_FROM` is empty.
- `scripts/test.sh` and `scripts/down.sh` go through `docker compose -p hull` (down includes test / studio / dns profiles so the group empties).

---

## [0.1.0] — 2026-08-16

### Added

- Standalone hull: clone, `setup-local.sh`, `up.sh`. Own Traefik, project CA, `*.dev` hosts. No workstation network.
- Three surfaces: `www` (`hull.dev`), `web` (`app.hull.dev`), `admin` (`admin.hull.dev`).
- Vite + React 19 + Tailwind 4 + shadcn default. FastAPI adapter. User + Org, cookie session, support “view as”.
- Lab: Postgres, RustFS, Mailpit. Seed `ada@hull.dev` / `admin@hull.dev` (`demodemo1`).
- `schema/` (SQL) and `contracts/openapi.yaml` as the portable contracts. `scripts/migrate.sh` applies SQL with psql; compose migrate uses the Postgres image, not `hull-api`.
