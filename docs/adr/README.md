# Decisions

One file per architectural decision, in the [Nygard format](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions):
**Status · Context · Decision · Consequences**.

`AGENTS.md` states the rule in one line and links here. That split is deliberate:
the rule has to live in the file agents always read, and the reasoning has to live
somewhere it can be argued with.

**Never edit a decision to reverse it.** Write a new one and set the old one to
`Superseded by NNNN`. That history is the point — `HANDOFF.md` told readers not to
rebuild auth right after auth was deliberately rebuilt, because there was nowhere
to record that a decision had been replaced. See 0008 and 0009 for the shape.

Status is one of `Proposed`, `Accepted`, `Superseded by NNNN`, `Deprecated`.

| # | Decision | Status |
|---|---|---|
| [0001](0001-vite-react-shadcn-default-no-next.md) | Vite + React + shadcn default, no Next.js | Accepted |
| [0002](0002-sql-in-schema-applied-by-migrate-sh.md) | SQL in `schema/`, applied by `scripts/migrate.sh` | Accepted |
| [0003](0003-openapi-yaml-is-the-contract.md) | `contracts/openapi.yaml` is the contract | Accepted |
| [0004](0004-postgres-is-the-store.md) | Postgres is the store | Accepted |
| [0005](0005-traefik-inside-the-compose-project.md) | Traefik inside the compose project | Accepted |
| [0006](0006-white-label-values-at-runtime.md) | White-label values resolved at runtime | Accepted |
| [0007](0007-hosts-are-dot-test.md) | Hosts are `*.test` | Accepted |
| [0008](0008-session-cookie-scoped-to-the-apex.md) | Session cookie scoped to the apex | Superseded by 0009 |
| [0009](0009-host-scoped-cookie-and-support-hand-off.md) | Host-scoped cookie and support hand-off | Accepted |
| [0010](0010-effective-org-id-is-the-only-org-accessor.md) | `effective_org_id` is the only org accessor | Accepted |
| [0011](0011-keep-the-built-in-login-lifecycle.md) | Keep the built-in login lifecycle | Accepted |
| [0012](0012-browser-e2e-with-playwright.md) | Browser E2E with Playwright, in CI | Accepted |
| [0013](0013-agentic-qa-harness.md) | An agentic QA harness that starts dirty | Accepted |
| [0014](0014-cli-peer-harness-for-the-three-agents.md) | A CLI peer harness, so the three agents can ask each other | Accepted |

Business rules and the object model are not decisions — they are in
[`docs/domain.md`](../domain.md).
