# 0012. Browser E2E with Playwright, in CI

**Status:** Accepted  
**Date:** 2026-08-17

## Context

Hull has API-level coverage: 34 pytest cases against the adapter, and
`scripts/smoke.sh` exercising a live stack over HTTP. Neither runs a browser.

That gap is not theoretical. **Avatar upload never worked** — the shared client set
`Content-Type: application/json` on a `FormData` body, which suppressed the
multipart boundary. The API was correct, the tests were correct, and the feature
was broken for every user. No amount of curl catches a bug in how the browser
builds a request.

The same class produced the other severe findings of the 2026-08-16 review: the
dev inner loop that served 502 on every surface, and a redirect loop that only
existed in a browser carrying a cookie from the previous build.

`scripts/smoke.sh` is not the place to fix this. It is an HTTP check of a live
install and is useful precisely because it is small and fast. Growing a browser
into it would blur two jobs and make both worse.

## Decision

Add browser end-to-end tests with **Playwright**, run in CI against the real
compose stack.

Deterministic scripts, not an agent. The agent writes and maintains them; CI runs
them. That is the split the industry settled on, and it is the only one that gives
a reproducible failure.

Scope is the critical paths, not every rule — the flows where a break is invisible
to the API tests. Roughly: signup through to a workspace, sign in and out, photo
upload, password change, and the admin "View as" hand-off.

`AGENTS.md` says to drive the browser with `agent-browser`, not Playwright MCP.
That still holds: it is about an **agent** judging pixels, which stays as it is.
This decision is about a deterministic suite, which is a different job.

## Consequences

CI must bring up the compose stack — certificates, hosts entries, images — so it
goes from roughly ninety seconds to several minutes. That is the price of covering
the layer where the worst bugs were, and it is paid once per push rather than by a
user.

Two suites now exist with different jobs, and the boundary has to be kept:
`scripts/test.sh` for adapter behaviour, `e2e/` for what a browser does.
`scripts/smoke.sh` stays an HTTP check of a live install and does not grow a
browser.

E2E is the slowest and flakiest layer in any suite. Assertions go on user-visible
outcomes and stable `data-testid` hooks, never on timing. A flake gets fixed or
deleted — a suite people re-run until it passes is worse than no suite, and this
repo has already been bitten by checks that passed while testing nothing.

An **agentic** QA harness — letting an agent drive these flows on demand during a
task — is deliberately out of scope here and is a separate decision.
