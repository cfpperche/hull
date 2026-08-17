# 0004. Postgres is the store

**Status:** Accepted  
**Date:** 2026-08-16

## Context

Hull ships the same artifacts to a laptop and a self-host box. Every additional
stateful service is another thing an operator has to run, back up and upgrade — so
the bar for adding one is "something needs it", not "it might be useful later".

## Decision

Postgres is the **default** store. Reach for it first: state that needs a TTL is a
table with an `expires_at` column, and a counter is a row.

Adding a stateful dependency — Redis, a queue, a search index — is a decision, not
a prohibition. Make it when a product module or a measured problem calls for it,
and supersede this ADR when you do. What is banned is acquiring one *by accident*,
because a library defaulted to it or because it was convenient in the moment.

## Consequences

Sessions and single-use tokens are rows, so they are inspectable and revocable with
SQL, and there is one thing to back up.

Rate limiting currently lives at the edge, in Traefik's memory, rather than in a
shared store. That is the honest trade: the counter is per-instance and resets on
restart. If Hull ever runs more than one edge, or needs limits that survive a
restart, that is exactly the kind of "something needs it" this ADR is written to
allow — write 00NN, mark this superseded, and add the dependency deliberately.

The escape hatch is the point. A rule with no way out gets ignored rather than
argued with, and then the dependency arrives anyway, undocumented.
