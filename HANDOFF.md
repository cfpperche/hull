# Hull handoff

**Date:** 2026-08-16  
**Repo:** `https://github.com/cfpperche/hull` (public)  
**Workspace:** `/home/goat/hull`

Start of session: read this, then `AGENTS.md`. Decisions and their history are in
`docs/adr/`; the object model and business rules are in `docs/domain.md`.

## What it is

Standalone app shell + chrome. Vite + React + shadcn default + FastAPI adapter. User + Org. White-label **values** in `.env`. Compose project `hull`. Default host **`hull.test`**.

## Up

```bash
cd /home/goat/hull
sudo ./scripts/setup-local.sh    # Linux hosts+CA; WSL also Windows UAC
./scripts/up.sh                  # always rebuilds; waits for the edge to serve
./scripts/smoke.sh
```

Lab: `ada@hull.test` / `demodemo1`. Admin: `admin@hull.test` / `demodemo1`.

This workstation: Hull binds `127.0.0.1:80` and `:443`. Postgres is published on `:55435` when `:5432` is already taken. Another compose project on the same edge must be down first.

Lab services come up with the stack, linked from the admin sidebar: `mail.` (Mailpit), `rustfs.` (objects console), `db.` (dbgate, needs `HULL_DBGATE_USER` / `HULL_DBGATE_PASSWORD`).

## Shipped

- Three surfaces: www / web / admin
- Schema in `schema/`, OpenAPI in `contracts/`, default adapter in `adapters/fastapi/`, migrate via `scripts/migrate.sh`
- Windows + WSL hosts/CA (`setup-windows-from-wsl.sh`)
- `scripts/prune.sh` — no leftover migrate/testdb in the compose group
- Agent files + visual harness (agent-browser)
- First visual pass: `@source` for `@hull/ui`, desktop rail, auth frame, quiet empty home
- Adversarial review and its four follow-up stages (PRs #1–#9). See `CHANGELOG.md` for what changed and why

## How the session works now

Changed by the review — the old notes here described the previous model.

- The cookie is **host-scoped**. `app.` and `admin.` hold separate sessions; signing out of one does not touch the other. It carries `Secure`, which depends on `cli.py` passing `forwarded_allow_ips` — uvicorn trusts only `127.0.0.1` and Traefik dials from a bridge IP.
- Sessions are **per-device**. Signing in elsewhere no longer signs this one out.
- Support "View as" does not carry a session across hosts. It mints a single-use, 60-second hand-off token (`schema/migrations/002_support_handoff.sql`), passed in a **URL fragment** so it never reaches a server log, and `POST /v1/session/handoff` exchanges it for a 45-minute impersonating session on `app.`. Stop ends that session and returns to the console.
- `effective_org_id()` in `accounts.py` is **the only supported way** to resolve the org a request operates on. The raw field is named `session_org_id` so a direct read is a loud miss, and a test fails the build if anything outside `accounts.py` touches it. Product modules: use the accessor.

## Gates

`scripts/test.sh` runs `ruff check`, `ruff format --check`, then pytest (34). CI also builds all three frontends and one frontend image, which is what catches drift in the hardcoded importer list in `deploy/docker/frontend.Dockerfile`.

`smoke.sh` validates TLS against the system trust store (`curl` without `-k`), so it doubles as the trust check. `capture-ui.sh` asserts sign-in out of band — `agent-browser` exits 0 on a failed step, so an in-batch check cannot fail it.

When you add a guard, prove it fails: plant a violation, watch it reject, remove it. Three guards in this repo's history passed while testing nothing.

## Next (not started)

- **Dogfood skill (browser signup).** The visual loop is stable enough now. Design it to cover **inherited state**, not just a clean profile: the redirect loop in PR #9 survived review, 34 tests, smoke, the harness and green CI because all of them start from an empty browser, and it only existed for browsers carrying a cookie from the previous build.
- Product module in `modules/` when there is a sold job

## Later — component lab (do not do now)

When `@hull/ui` has a real catalog (Shell, Button states, empty, toast) **then** add Storybook and consider **Chromatic** for component visual regression on PRs. It has `button`, `confirm-dialog`, `input`, `label`, `sonner` plus shell/brand/theme — not a catalog yet.

Until then: agent-browser + PNG judgment. After a look we like: `agent-browser diff screenshot --baseline` locally. Not Chromatic on full pages.

## Do not rebuild

Org isolation, Traefik-in-compose, `config.json` runtime brand, and the session model as described above — auth and the cookie were rebuilt deliberately in PRs #3, #5 and #9. Read that section before changing either.

## Open, and owned by the operator

- `capture-ui.sh` sets `AGENT_BROWSER_IGNORE_HTTPS_ERRORS`, so it cannot tell a trusted certificate from an untrusted one. Left as is: judging pixels and testing TLS are different jobs, and `smoke.sh` already covers the second.
- The CA on this workstation was rotated to a name-constrained one. A fresh clone gets constraints on first issue; an older install is detected and told how to rotate.
