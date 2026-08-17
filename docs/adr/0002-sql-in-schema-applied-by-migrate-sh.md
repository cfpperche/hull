# 0002. Sql in schema applied by migrate sh

**Status:** Accepted  
**Date:** 2026-08-16

## Context

The adapter is replaceable. If it also owns DDL, swapping it means porting the
migration runner - and two runners drift silently. That is not hypothetical: the
FastAPI adapter carried a second runner whose only caller was the test suite, so any
drift would have stayed invisible until a fresh install.

## Decision

SQL lives in `schema/`. `scripts/migrate.sh` is the only runner. No DDL in any adapter.

## Consequences

A non-Python adapter needs no migration work. Each file applies atomically with its
bookkeeping row under an advisory lock, so an interrupted run cannot wedge the next
one. `pytest` run outside `scripts/test.sh` skips rather than bootstrapping a schema.
