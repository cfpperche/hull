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

Superseding is the normal path, not a failure. Every decision here is reversible by
writing the next one — the format exists so a change is argued and recorded rather
than smuggled in. A rule with no way out does not get respected; it gets ignored,
and then the thing it prevented arrives anyway with nothing written down.

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
| [0011](0011-keep-the-built-in-login-lifecycle.md) | Keep the built-in login lifecycle | Proposed |

Business rules and the object model are not decisions — they are in
[`docs/domain.md`](../domain.md).
