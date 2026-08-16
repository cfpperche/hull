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

### Security

- Credential endpoints are rate-limited at the edge. `/v1/auth/*` and `/v1/me/password` go through a Traefik `rateLimit` middleware (10/min per client IP, burst 20) on new routers at priority 200. Nothing throttled them before, so a breach list could be sprayed at full speed against an 8-character minimum. The counter is in Traefik's memory — `AGENTS.md` forbids adding Redis. Same limit in the dev edge: a dev override that behaves differently from prod is where rate-limit surprises come from.
- `dbgate` is no longer an unauthenticated SQL console on the live database. It gets `LOGIN`/`PASSWORD` from `HULL_DBGATE_USER`/`HULL_DBGATE_PASSWORD` (without them its auth provider is literally `none`), and the `hull-db` router gets a Traefik `basicAuth` middleware — the second lock holds even if that image is swapped. `render-edge.sh` generates the htpasswd hash into the gitignored `dynamic.yml`, so it never lands in the tree.
- `db.<host>` is only written to `/etc/hosts` when `HULL_STUDIO=1`. It was installed permanently, on Linux and Windows, for a profile that is off by default.

- Session cookie now carries `Secure`. It never did: the flag was derived from the connection scheme, and uvicorn ran with `proxy_headers` but no `forwarded_allow_ips`, so Traefik's `X-Forwarded-Proto` was dropped (uvicorn trusts only `127.0.0.1`, Traefik dials from a bridge IP) and every live install saw `http`.
- Changing the password now revokes **every** session including the caller's, and returns a fresh cookie. Previously the one token the code deliberately preserved was the caller's own — so a stolen cookie survived the action taken to revoke it, while the contract advertised "other sessions die".
- `migrate.sh` refuses to apply the demo seed unless `HULL_HOST` ends in `.test`. The seed installs a `platform_admin` whose password is printed in the README and defaulted to on for any host.
- Avatar uploads are refused on `Content-Length` before the body is buffered. The 5 MB cap ran only after the whole request was in memory, so one large upload could drive the API container into the gigabytes.
- Traefik gets the leaf certificate pair only, not the whole `deploy/certs` tree — which handed the container `ca/ca.key`, the key to a CA installed in the host and Windows root stores. New CAs are issued with name constraints limiting them to `.test` and `localhost`.
- `signin` always spends the hash cost, so a missing account is not distinguishable from a wrong password by response time.
- The adapter no longer publishes FastAPI's generated docs at `/api/docs`, `/api/redoc` and `/api/openapi.json` — a second, divergent spec served unauthenticated on both the customer and admin hosts.
- The API binds `127.0.0.1` by default (the container image still sets `0.0.0.0`), so the host-side dev loop is not published to the LAN.
- `.gitignore` covers every dotenv variant, not just the bare `.env`.
- CI actions are pinned to commit SHAs and the workflow declares `permissions: contents: read`.

### Fixed

- **Avatar upload never worked.** The shared client set `Content-Type: application/json` on every request with a body, including `FormData`, which suppressed the multipart boundary — so the server could not parse any upload.
- **The documented `scripts/dev.sh` inner loop served nothing.** All three Vite configs bound `127.0.0.1` while the dev edge dials the docker host-gateway (502), and binding wider hit Vite's host check (403). They now use `host: true` with `allowedHosts` and an HMR client port for the TLS edge.
- **`setup-local.sh` never read `.env`**, so a white-label `HULL_HOST` never reached `/etc/hosts` while `up.sh` happily issued certificates and routers for it — a correctly configured, unreachable stack. It also backs up `/etc/hosts` and guards against a missing trailing newline.
- `.env` is now parsed the way compose parses it. `set -a && source` ran the file as shell, so `HULL_BRAND=Acme Corp` printed `Corp: command not found` and left the brand at its default in `config.json` while the containers got the right value.
- `dev.sh` writes its computed environment to `.env.dev` instead of discarding it; the inner-loop API was connecting to `:5432` rather than `HULL_PG_PORT`, with mail and object storage disabled.
- A non-UUID org id returned a bare `500` instead of the contracted `404`/`422`, and the plain-text body then broke the client's JSON parse. Ids are typed, and every unhandled error leaves as `problem+json`.
- Postgres readiness is probed over TCP with consecutive successes. The socket-only probe went green during `initdb`, so a first `up.sh` could run migrate against a closed port.
- `migrate.sh` applies each file and its tracking row in one transaction under an advisory lock. A mid-file failure used to commit the earlier statements and record nothing, wedging the runner permanently.
- `up.sh` always rebuilds. Images are pinned at `:0.1.0`, so "build only when the tag is missing" meant every run after the first served the first build — and the visual harness judged pixels from stale code.
- Clearing a display name now clears it. `COALESCE` discarded the write while the UI reported "Profile saved".
- `preflight.sh` sees a listener on any bind address, not just `127.0.0.1`; `smoke.sh` asserts a successful switch before trusting the isolation 404, checks the `reason_code`, and no longer writes to a predictable `/tmp` path; `capture-ui.sh` asserts sign-in actually happened before capturing the signed-in surfaces; `prune.sh` scopes its image prune to Hull's own label.
- `render-edge.sh`'s dot-escaping survives sed, so the CoreDNS regex no longer matches `hull-test.` alongside `hull.test`.
- Uvicorn's startup and access lines are emitted through the JSON formatter, so the container's stdout is uniformly JSON as `AGENTS.md` claims.
- Pillow decode errors are mapped to `422`, not `500`; a closed account's photo is deleted from the object store.

### Changed

- **Sessions are per-device.** Every sign-in used to delete all of the user's other sessions, so signing in on a phone dropped the laptop to the sign-in screen mid-task.
- Action feedback, per the `AGENTS.md` table: closing an account takes a confirmation dialog before it runs; a failed workspace switch, a failed support "Stop" and a failed admin "View as" now report and hold a pending state instead of being empty clicks; photo errors are inline rather than toasted; replacing a photo actually updates the chrome.
- `contracts/openapi.yaml` describes what the adapter does: a root `security` requirement with explicit public opt-outs (all sixteen operations were specified as unauthenticated, including `/v1/admin/*`), a `Problem` schema with the `reason_code` enum, the reachable error statuses, the admin response envelopes, and OpenAPI 3.1 union types instead of the ignored `nullable: true` that made the schema reject every signup response.
- The admin app has a catch-all route; unknown paths rendered a blank page.
- `scripts/lib/env.sh` is the one place `.env` is read.

### Removed

- The second migration runner inside the FastAPI adapter (`db.py`), which carried its own DDL against the `AGENTS.md` schema lock and could silently drift from `scripts/migrate.sh`. Tests now rely on the bash runner.
- The hardcoded `SESSION_COOKIE` constant in `@hull/config` — the cookie is `HttpOnly`, so no browser code can read it, and the literal contradicted the `HULL_COOKIE_NAME` knob. The hardcoded host list in `deploy/edge-hosts.txt`, which wrote eight stale `hull.test` entries on every white-label install.

### Changed

- Benchmarks: only Vercel / Linear / Supabase (plus Stripe on www). Do not import another product’s sector list.
- First visual pass: Tailwind now scans `@hull/ui` (shell/button/input were shipping unstyled). Desktop rail, centered auth with brand, quiet empty home, no surface cards on www.
- HTTP implementation lives in `adapters/fastapi/` (`hull_fastapi`). Compose service `api` and image `hull-api` stay the process slot. The contract remains `contracts/openapi.yaml`.
- Docs no longer name other products in this workspace. Hull stands alone.

### Removed

- Agent role split (Grok orchestrates, Claude only when asked, Codex adversarial review) and `harness/orchestration.md`. Hull’s operating model is not defined yet.

### Fixed

- `up` no longer leaves `hull-migrate` Exited in the VS Code group (`migrate` is profile `tools`; `compose run --rm`). `test.sh` removes `hull-test-pg` after pytest (also on failure). `scripts/prune.sh` clears those leftovers.

### Added

- Agent kit: `AGENTS.md` (single source), `CLAUDE.md` / `GROK.md` / `CODEX.md` pointers, `HANDOFF.md`, `harness/benchmarks.md`.
- Visual harness on **agent-browser** (not Playwright): `harness/scripts/capture-ui.sh`, `harness/visual-ux.md`, `.grok/skills/visual-ux`. Chromatic deferred until `@hull/ui` is a Storybook catalog.

- Windows + WSL setup: `setup-windows.ps1` + `setup-windows-from-wsl.sh`. `setup-local.sh` on WSL opens UAC and writes Windows `hosts` + trusts the project CA. Chrome on Windows does not use the WSL `/etc/hosts`.

### Changed

- Default host is **`hull.test`**. `.dev` is a public gTLD (`hull.dev` resolves on the internet, HSTS preload). `.local` is reserved for mDNS — do not use it.

### Added

- White-label **values** in `.env`: `HULL_BRAND`, `HULL_MARK`, `HULL_COOKIE_NAME`, plus existing `HULL_HOST`. `scripts/render-brand.sh` writes `/config.json` at start (no SPA rebuild). Chrome, mail subject/from, and lab seed emails follow those values.
- Lab seed template `schema/seed/001_lab.sql.tmpl` (`ada@` + host).
- Compose `testdb` (`profile: test`) so pytest Postgres lives in the **hull** group in Docker Desktop / VS Code Containers.
- Labels `hull.project` / `hull.role` on every service so the compose project groups in Docker Desktop / VS Code.

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
