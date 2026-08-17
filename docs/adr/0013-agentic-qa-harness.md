# 0013. An agentic QA harness, driven from the shell, that starts dirty

**Status:** Accepted  
**Date:** 2026-08-17

## Context

ADR-0012 added a deterministic browser suite and left the agentic case open. This
is that decision.

Hull now has four layers of checking, and all four start from nothing: pytest
builds a fresh client, `e2e/` opens a clean browser, `smoke.sh` is a bare `curl`,
`capture-ui.sh` clears cookies between surfaces. That is correct for each of them
and it is also a shared blind spot.

The redirect loop in PR #9 lived in that spot. A build before the host-scoped
cookie left `Domain=.hull.test` in real browsers; the next build set a host-scoped
cookie beside it; the server read the last of two identically-named cookies. It
survived an adversarial review, 34 tests, `smoke.sh`, the visual harness and green
CI — and the operator hit it on the first sign-in. Nothing in the repo could have
caught it, because catching it requires a browser that has been somewhere before.

Three agents work in this repo — Claude, Codex and Grok — sharing `AGENTS.md`.
`agent-browser`'s default session is a single browser for the whole machine, so
two agents exploring at once hijack each other's page.

## Decision

Add `harness/scripts/qa.sh`: a harness an agent runs **on demand, mid-task**, to
explore a live install. Protocol in `harness/qa.md`.

**Shell, not MCP.** The three agents share a repo and a shell; they configure MCP
differently, and the one that has not configured it would find the harness
silently absent. A script in the tree is the one interface all three certainly
have. It also keeps the existing lock — drive the browser with `agent-browser` —
rather than reopening it.

**The harness sets the table; the agent drives.** It does not wrap `click` or
`fill`. Wrapping them would add a second vocabulary to learn on top of the one
`agent-browser skills get core --full` already teaches, and every wrapper is a
place for the harness to lie about what the browser did. What it owns is the part
that is Hull-specific and repeated: an isolated session per agent, a persona
proven signed in, a chosen starting state, an evidence directory.

**Starting state is a first-class argument.** Personas (`anon`, `member`, `admin`)
crossed with taints (`clean`, `legacy-cookie`, `stale`, `junk`, `carry`).
`legacy-cookie` is PR #9 reduced to one flag. `carry` reopens whatever the last
run left. This is the whole reason the harness exists and it is the one thing
`e2e/` must never adopt: a deterministic suite that starts dirty is not
deterministic.

**Headless by default, human by opt-in.** `--headed` opens a real window;
`qa.sh watch` streams the same live session to a dashboard where a person can
watch and take over. Neither is needed for a normal run.

**It does not run in CI.** Exploration has no pass/fail. A finding that deserves
to be permanent gets written as an `e2e/` spec or a pytest case, and that suite is
what guards it from then on.

## Consequences

A fifth thing that drives a browser now exists, and the boundary has to be kept.
The failure mode is obvious: someone teaches `e2e/` to plant a cookie, or grows
`smoke.sh` a browser, and two jobs get worse at once. `harness/qa.md` states the
split and `AGENTS.md` links it.

Findings from this harness are unreproducible unless the state is stated. A bug
that only exists under `--taint legacy-cookie` reads as a fabrication to whoever
reads the report next, so a finding names its persona and taint or it is not a
finding.

Runs write to `harness/qa/runs/`, gitignored like `harness/visual/`. Evidence is
worth keeping for the length of a task, not for the length of the repo.

The harness can lie in exactly one way that matters: reporting a state it failed
to apply. Chrome refuses illegal cookie values with one line of output and a zero
exit — the first `junk` taint written here did precisely that and produced a run
that claimed a taint it never planted. Every taint is now read back after planting
and a mismatch kills the run. Same reason sign-in is asserted out of band: three
guards in this repo's history passed while testing nothing.
