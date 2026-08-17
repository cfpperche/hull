# 0004. Postgres is the store

**Status:** Accepted  
**Date:** 2026-08-16

## Context

Hull ships the same artifacts to a laptop and a self-host box. Every additional
stateful service is another thing an operator has to run, back up and upgrade.

## Decision

Postgres is the store. No database microservice, no Redis, no separate queue. State
that needs a TTL is a table with an `expires_at` column.

## Consequences

Rate limiting lives at the edge (Traefik, in memory) rather than in a shared store.
Sessions and single-use tokens are rows, so they are inspectable and revocable with
SQL. A feature that genuinely needs a queue or a cache has to revisit this decision
rather than smuggle in a dependency.
