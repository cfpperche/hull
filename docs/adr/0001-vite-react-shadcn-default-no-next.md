# 0001. Vite react shadcn default no next

**Status:** Accepted  
**Date:** 2026-08-16

## Context

Hull is an app shell reused across installs. The frontend choice is the one thing every
future product module inherits, and a framework with its own server changes what "the
API" means - Hull already has an HTTP contract and a replaceable adapter.

## Decision

Vite + React + Tailwind 4 + **shadcn default** for all three surfaces. No Next.js. No
custom design-token sheet on top of the shadcn defaults.

## Consequences

No server-side rendering and no framework-owned routes, so `contracts/openapi.yaml`
stays the only server surface. Staying on shadcn defaults makes a new component a
copy-in rather than a design decision, and keeps the chrome from drifting into a
second visual language.
