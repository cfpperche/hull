# 0011. Keep the built in login lifecycle

**Status:** Accepted  
**Date:** 2026-08-16 · decided 2026-08-17

## Context

Hull already implements signup, signin, signout, password change with full session
revocation and token rotation, account closure, per-device sessions and support
impersonation. Missing from a complete lifecycle: password reset and email
verification. The alternative is adopting a self-hosted identity service.

## Decision

Keep the built-in lifecycle and add the two missing pieces, reusing the single-use
token pattern already proven by `support_handoffs` and the existing `mail.py`.

Password reset shipped 2026-08-17 on exactly that pattern: `password_resets`
mirrors `support_handoffs` row for row, redeemed with the same
`used_at IS NULL … RETURNING`, and the link carries its token in the fragment for
the same reason the hand-off does. Email verification is the remaining piece.

## Consequences

A service would collide with 0004 (its own store), the object model in
`docs/domain.md` (its own realm or tenant concept) and the impersonation rule, which no
off-the-shelf product implements - it would be rebuilt on top regardless. It would also
replace the auth half of the adapter, the contract's security scheme and the session
handling in all three surfaces, which is most of what Hull is.

This flips on a business trigger, not an engineering one: a customer requiring SSO
(today a stated non-goal in `README.md`), a compliance requirement against holding
credentials, or mandatory MFA. If it flips, the least invasive fit is an API-first
service that imposes neither a UI nor a tenant model.
