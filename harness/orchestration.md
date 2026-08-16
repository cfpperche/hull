# Orchestration — Hull

**Normative.** The human talks to Grok. On a **material** slice Grok does not silently implement: it classifies, writes or delegates a plan, presents, waits for **go**.

This is one git repo. Do not invent a second process or a mandatory review on every one-line fix.

## Size

| Size | Do |
|---|---|
| **Small** | One obvious file, no new object, no auth/session/tenancy, no new chrome. Implement in the turn. |
| **Material** | Plan in `harness/<name>-plan.md`. Present. Stop for go. Then implement. |

Material includes: auth, cookie, schema, compose, Windows setup, any user-visible UI, new surface.

## Cadence (material)

```text
intake     restate in User / Org / Install
plan       harness/<name>-plan.md — UI slices include 3–6 benchmark sentences
present    show the plan. STOP for go
implement  against the plan
review     Codex if auth/schema/cookie/UI (English, harness/reviews/)
validate   ./scripts/test.sh and/or ./scripts/smoke.sh
           UI: harness/scripts/capture-ui.sh + read_file on the PNGs
```

Claude only if the human asks.

## Evidence

| Claim | Required |
|---|---|
| Planned | `harness/<name>-plan.md` |
| Implemented | diff in this repo |
| Validated | test/smoke log |
| UI looks right | PNGs under `harness/visual/current/` **read**, not listed |

No evidence → say what was not verified.
