# Agent guidelines — Hull

Standalone SaaS **hull** (app shell + chrome). Not a product.

`CLAUDE.md`, `GROK.md`, and `CODEX.md` point here. Do not duplicate these rules there.

Read **`HANDOFF.md`** first for what exists and what is next.

| Where | What |
|---|---|
| [`HANDOFF.md`](./HANDOFF.md) | State of play. Read at session start. |
| [`docs/adr/`](./docs/adr/) | Why each decision was made, and which ones were superseded. |
| [`docs/domain.md`](./docs/domain.md) | What User, Org and Install mean; signup, isolation, support, sessions. |
| [`harness/action-feedback.md`](./harness/action-feedback.md) | What every write must confirm. Normative. |
| [`harness/benchmarks.md`](./harness/benchmarks.md) | Sector research, before pixels. |
| [`harness/visual-ux.md`](./harness/visual-ux.md) | Driving the browser to judge pixels. |
| [`harness/design/PROTOCOL.md`](./harness/design/PROTOCOL.md) | Measuring a build, then putting it to a panel of agents. Not CI. |
| [`harness/qa.md`](./harness/qa.md) | Exploring a live install mid-task, carrying state. Not CI. |
| [`harness/peer.md`](./harness/peer.md) | Asking one of the other two agents — delegation, audit, adversarial review. Not CI. |
| [`CHANGELOG.md`](./CHANGELOG.md) | Update under `[Unreleased]` before every push to `main`. |

Agent operating model (who plans, who implements, who reviews) is **not defined**.
Do not import a pipeline from another repo. `harness/scripts/peer.sh` lets one
agent ask another — it is a phone line, not an org chart, and turning it into a
standing pipeline needs its own ADR. → [0014](./docs/adr/0014-cli-peer-harness-for-the-three-agents.md)

## Locks

Hard invariants. Each links to the decision that explains it — change the decision
first, with a new ADR, not the code.

- Frontend: Vite + React + Tailwind 4 + shadcn **default**. No Next.js. No custom token sheet. → [0001](./docs/adr/0001-vite-react-shadcn-default-no-next.md)
- Schema: SQL in `schema/`. Migrate with `scripts/migrate.sh`. Do not put DDL in an adapter. → [0002](./docs/adr/0002-sql-in-schema-applied-by-migrate-sh.md)
- HTTP contract: `contracts/openapi.yaml`. The default adapter is `adapters/fastapi/`. Do not treat that folder as "the API". → [0003](./docs/adr/0003-openapi-yaml-is-the-contract.md)
- No database microservice, no Redis, no queue. Postgres is the store. → [0004](./docs/adr/0004-postgres-is-the-store.md)
- Edge: Traefik **inside** `deploy/compose.yaml`. Do not join an external Docker network. → [0005](./docs/adr/0005-traefik-inside-the-compose-project.md)
- White-label **values** live in `.env`. Chrome reads `/config.json`. Do not bake `VITE_HULL_HOST`. → [0006](./docs/adr/0006-white-label-values-at-runtime.md)
- Hosts: `*.test` (default `hull.test`, RFC 6761). Not `.dev`. Not `.local`. → [0007](./docs/adr/0007-hosts-are-dot-test.md)
- The session cookie is host-scoped. `app.` and `admin.` are separate sessions. → [0009](./docs/adr/0009-host-scoped-cookie-and-support-hand-off.md)
- Resolve the org with `accounts.effective_org_id(sess)` and nothing else. → [0010](./docs/adr/0010-effective-org-id-is-the-only-org-accessor.md)
- Objects: **User** = login, **Org** = workspace, **Install** = this compose. No Company/Store. → [`docs/domain.md`](./docs/domain.md)
- Support impersonates an **org**. Do not mint the customer's session. → [`docs/domain.md`](./docs/domain.md)
- Compose project name is **`hull`**. Never `docker run` a Hull process.
- Windows Chrome does not use WSL `/etc/hosts`. `setup-local.sh` on WSL must open UAC (`setup-windows-from-wsl.sh`).

## Surfaces

| App | Host | Auth |
|---|---|---|
| `apps/www` | `hull.test` | none |
| `apps/web` | `app.hull.test` | cookie |
| `apps/admin` | `admin.hull.test` | `platform_admin` |

## UI/UX — research before pixels

Before changing layout, navigation, forms, empty states, onboarding, or copy, read
**`harness/benchmarks.md`** for **that sector**. That file is the only set. Do not
pull a sector family from another repo.

Write 3–6 sentences in the turn: what those products do, what we copy, what we
refuse. Then implement. Do not invent a third visual language.

Visual judgment requires **pixels** (`harness/visual-ux.md`, skill `visual-ux`).
Research is not a screenshot substitute. Drive the browser with **agent-browser**,
not Playwright MCP.

For a whole pass rather than one screen, `./harness/design/bin/design` measures
every surface (contrast, hit targets, type scale, layout breaks, the tells that
make a page look generated) and then puts the pixels to three critics with
different lenses, an adversary that tries to kill each finding, and an arbiter.
`sense` is deterministic and costs nothing; `panel` is judgment, costs money and
is **never** a gate. It is decoupled on purpose: everything it knows about this
repo is `design.config.json` at the root, and `design selftest` fails if the
harness itself learns a host, a route or a product name.
→ [0015](./docs/adr/0015-design-harness-is-decoupled-and-not-a-gate.md)

Every write must confirm — **`harness/action-feedback.md`** is normative.

## Verifying

`./scripts/test.sh` runs ruff, the formatter check, then pytest. `./scripts/smoke.sh`
exercises the live stack and validates TLS against the system trust store.

To poke a live install while working — signed in, or carrying a cookie from the
build before — use `./harness/scripts/qa.sh` (**`harness/qa.md`**). It is
exploration, not a gate: it never runs in CI, and a finding worth keeping becomes
an `e2e/` spec or a pytest case. → [0013](./docs/adr/0013-agentic-qa-harness.md)

For a second opinion from a different vendor's model — a review, one claim audited,
or a blind adversarial `duel` — use `./harness/scripts/peer.sh` (**`harness/peer.md`**).
Reviewers run read-only and the harness proves it by watching the tree, not by
trusting the flag. Its answers are evidence, never a verdict, and never a gate.
→ [0014](./docs/adr/0014-cli-peer-harness-for-the-three-agents.md)

Prove a claim against what is running, not against the diff. When you add a guard,
plant a violation and watch it fail before trusting it — several guards in this
repo's history passed while testing nothing.

## Do not

- Add a worker, Redis, or Grafana unless a product module requires it.
- Observe is JSON stdout + `install_events`. No collector required.
- Do not put product domain in `packages/ui` or adapter auth.
- Do not add Storybook or Chromatic until `@hull/ui` is a component catalog (`HANDOFF.md`).
- Do not generate product UI with `image_gen`.
