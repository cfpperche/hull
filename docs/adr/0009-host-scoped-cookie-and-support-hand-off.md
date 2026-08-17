# 0009. Host scoped cookie and support hand off

**Status:** Accepted  
**Date:** 2026-08-16

## Context

Supersedes [0008](0008-session-cookie-scoped-to-the-apex.md). The apex-scoped cookie
attached a live 14-day token to every sibling host. Dropping the scope is one line, but
it breaks the one flow that depended on it: admin "View as".

## Decision

The session cookie is host-scoped - no `Domain`. `app.` and `admin.` hold separate
sessions. "View as" mints a single-use, 60-second hand-off token, passed in a URL
**fragment** so it never reaches a server log or a `Referer` header, and exchanged at
`POST /v1/session/handoff` for a 45-minute impersonating session.

## Consequences

Signing out of one surface no longer affects the other. Impersonation lives on the
customer surface, where data is scoped, and the admin console stays un-acted.
Redemption is atomic and re-checks the role, so a demoted operator cannot redeem a
token minted while they still had it.

A cookie scope change needs a migration, which this one shipped without: browsers
holding the old cookie sent both, the server picked the legacy one, and the two
surfaces bounced each other. The adapter now retires the apex cookie on sight.
