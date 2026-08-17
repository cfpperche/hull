# 0008. Session cookie scoped to the apex

**Status:** **Superseded by [0009](0009-host-scoped-cookie-and-support-hand-off.md)**  
**Date:** 2026-08-16

## Context

The three surfaces live on sibling hosts under one apex, and the admin console hands an
operator to the product surface for support. A cookie scoped to `.<apex>` made that
hand-off free: the browser carried the session across hosts.

## Decision

Issue the session cookie with `Domain=.<apex>`.

## Consequences

Superseded. The same scope handed a live session token to every other sibling -
`mail.`, `s3.`, `rustfs.`, `db.` - none of which authenticate anyone, and `SameSite=lax`
does not separate same-site siblings.
