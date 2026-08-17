# 0007. Hosts are dot test

**Status:** Accepted  
**Date:** 2026-08-16

## Context

The default apex is typed into browsers and written into `/etc/hosts`. `.dev` is a real
gTLD on the HSTS preload list, and `.local` is reserved for mDNS.

## Decision

Hosts are `*.test` (RFC 6761), default `hull.test`. Never `.dev`, never `.local`.

## Consequences

The local CA is name-constrained to `.test`, `localhost` and `127.0.0.1`, so a leaked
key signs nothing outside the lab. Test fixtures use `.test` too, since the tests are
what the next author copies.
