# 0010. Effective org id is the only org accessor

**Status:** Accepted  
**Date:** 2026-08-16

## Context

A support operator's session carries the customer's org in `acting_org_id` and nothing
in the session's own org column. Code that reads the raw field scopes an impersonated
request to the wrong org, or to none.

## Decision

`accounts.effective_org_id(sess)` is the only supported way to resolve the org a
request operates on. The raw field is named `session_org_id` so a direct read is a loud
miss, and the role and expiry checks live in one place, `SessionPrincipal.acting()`, so
the chrome and the data scope cannot disagree.

## Consequences

Product modules in `modules/` must call the accessor. A test fails the build if
`session_org_id` appears outside `accounts.py` - the guard that catches the first
module author instead of a review comment.
