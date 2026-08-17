# 0005. Traefik inside the compose project

**Status:** Accepted  
**Date:** 2026-08-16

## Context

A shared workstation proxy makes the install depend on something outside its own
compose file, and two projects then fight over ports and certificates.

## Decision

Traefik runs inside `deploy/compose.yaml` as part of the `hull` project. It does not
join an external Docker network. It binds `${HULL_BIND:-127.0.0.1}` on 80 and 443.

## Consequences

Two Hull installs on one daemon need different binds or ports; one must be down for
the other to hold the edge. The project is self-contained - `up.sh` brings up
everything the hostnames need. Traefik receives only the leaf certificate pair, never
the CA private key.
