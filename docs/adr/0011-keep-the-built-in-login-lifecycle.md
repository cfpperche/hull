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

Both shipped 2026-08-17 on exactly that pattern. `password_resets` and
`email_verifications` mirror `support_handoffs` row for row, are redeemed with
the same `used_at IS NULL … RETURNING`, and carry their token in the fragment for
the same reason the hand-off does. The lifecycle this decision was about is now
complete; what remains in account management — changing an address, seeing and
revoking sessions — builds on it rather than filling it in.

Verification informs, it does not gate. Nothing in Hull requires a confirmed
address yet, and inventing a wall would be policy this decision did not make.
The first thing that genuinely needs it is changing your email, which is why
`email_verifications` stores the address a link was sent to: a link minted before
a change must not rubber-stamp the address that replaced it.

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
