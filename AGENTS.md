# Agent guidelines — Hull

Standalone SaaS **hull** (app shell + chrome). Not a product.

`CLAUDE.md`, `GROK.md`, and `CODEX.md` point here. Do not duplicate these rules there.

Read **`HANDOFF.md`** first for what exists and what is next. Benchmarks by sector: `harness/benchmarks.md`. Visual loop: `harness/visual-ux.md`.

Update `CHANGELOG.md` under `[Unreleased]` before every push to `main`.

Agent operating model (who plans, who implements, who reviews) is **not defined**. Do not import a pipeline from another repo.

## Locks

- Frontend: Vite + React + Tailwind 4 + shadcn **default**. No Next.js. No custom token sheet.
- Schema: SQL in `schema/`. Migrate with `scripts/migrate.sh` (psql). Do not put DDL in FastAPI.
- HTTP contract: `contracts/openapi.yaml`. The default adapter is `adapters/fastapi/`. Do not treat that folder as “the API”.
- No database microservice. Postgres is the store.
- Objects: **User** = login. **Org** = workspace. **Install** = this compose. Do not add Company/Store unless a product module needs a second level.
- Edge: Traefik **inside** `deploy/compose.yaml`. Do not join an external Docker network.
- Compose project name is **`hull`**. Never `docker run` a Hull process.
- Hosts: `*.test` (default `hull.test`, RFC 6761). Not `.dev`. Not `.local` (mDNS).
- White-label **values** live in `.env` (`HULL_HOST`, `HULL_BRAND`, `HULL_MARK`, `HULL_COOKIE_NAME`). Chrome reads `/config.json`. Do not bake `VITE_HULL_HOST`.
- Signup: username + email + password. Then one workspace name.
- Windows Chrome does not use WSL `/etc/hosts`. `setup-local.sh` on WSL must open UAC (`setup-windows-from-wsl.sh`).

## Surfaces

| App | Host | Auth |
|---|---|---|
| `apps/www` | `hull.test` | none |
| `apps/web` | `app.hull.test` | cookie |
| `apps/admin` | `admin.hull.test` | `platform_admin` |

Support impersonates an **org**. Do not mint the customer’s session.

## UI/UX — research before pixels

Before changing layout, navigation, forms, empty states, onboarding, or copy, read **`harness/benchmarks.md`** for **that sector**. One family is not enough when the slice spans two sectors (e.g. www CTA + web signup).

Write 3–6 sentences in the turn: what those products do, what we copy, what we refuse. Then implement. Do not invent a third visual language.

Visual judgment requires **pixels** (`harness/visual-ux.md`, skill `visual-ux`). Research is not a screenshot substitute. Drive the browser with **agent-browser**, not Playwright MCP.

## Action feedback

Every write the operator starts must confirm. A button that returns to idle with no change is a bug.

| Action | Confirmation |
|---|---|
| Settings save, photo upload, non-destructive write that stays on the page | Short toast (`toast.success`). Button pending while in flight. |
| Field / schema validation | Inline next to the field. Do not toast schema errors. |
| Unexpected API failure on a form | Inline on the form. Toast only if the error would be off-screen. |
| Create that navigates to the new object | The destination is the confirmation. |
| Destructive / irreversible | Dialog **before**. After success: navigate or toast. |
| Immediate toggle / checkbox | The control state is the confirmation. |
| Long job | Progress toast / run card. |

Refuse: persistent “Saved.” banners, success splash pages, a confirm dialog for ordinary Save, empty clicks.

Copy: verb + object, past tense, short. `Profile saved`. Not `Success!`

## Do not

- Add a worker, Redis, or Grafana unless a product module requires it.
- Observe is JSON stdout + `install_events`. No collector required.
- Do not put product domain in `packages/ui` or adapter auth.
- Do not add Storybook or Chromatic until `@hull/ui` is a component catalog (`HANDOFF.md`).
- Do not generate product UI with `image_gen`.
