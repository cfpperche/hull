# Hull handoff

**Date:** 2026-08-16  
**Repo:** `https://github.com/cfpperche/hull` (public)  
**Workspace:** `/home/goat/hull`

Start of session: read this, then `AGENTS.md`. Decisions and their history are in
`docs/adr/`; the object model and business rules are in `docs/domain.md`.

## What it is

Standalone app shell + chrome. Vite + React + shadcn default + FastAPI adapter. User + Org. White-label **values** in `.env`. Compose project `hull`. Default host **`hull.test`**.

## Up

```bash
cd /home/goat/hull
sudo ./scripts/setup-local.sh    # Linux hosts+CA; WSL also Windows UAC
./scripts/up.sh                  # always rebuilds; waits for the edge to serve
./scripts/smoke.sh
```

Lab: `ada@hull.test` / `demodemo1`. Admin: `admin@hull.test` / `demodemo1`.

`./scripts/reset-lab.sh` (`make reset`) puts the lab back to that fixture in a
couple of seconds — database, inbox and avatar bucket — without dropping volumes
or rebuilding. `migrate.sh` cannot: its seed inserts `WHERE NOT EXISTS` and is
recorded in `schema_seeds`, so once ada exists with a changed password it is a
no-op. Refuses outside a `.test` apex, and with `HULL_SEED_DEMO=0`.

This workstation: Hull binds `127.0.0.1:80` and `:443`. Postgres is published on `:55435` when `:5432` is already taken. Another compose project on the same edge must be down first.

Lab services come up with the stack, linked from the admin sidebar: `mail.` (Mailpit), `rustfs.` (objects console), `db.` (dbgate, needs `HULL_DBGATE_USER` / `HULL_DBGATE_PASSWORD`).

## Shipped

- Three surfaces: www / web / admin
- Schema in `schema/`, OpenAPI in `contracts/`, default adapter in `adapters/fastapi/`, migrate via `scripts/migrate.sh`
- Windows + WSL hosts/CA (`setup-windows-from-wsl.sh`)
- `scripts/prune.sh` — no leftover migrate/testdb in the compose group
- Agent files + visual harness (agent-browser)
- First visual pass: `@source` for `@hull/ui`, desktop rail, auth frame, quiet empty home
- Adversarial review and its four follow-up stages (PRs #1–#9). See `CHANGELOG.md` for what changed and why

## How the session works now

Changed by the review — the old notes here described the previous model.

- The cookie is **host-scoped**. `app.` and `admin.` hold separate sessions; signing out of one does not touch the other. It carries `Secure`, which depends on `cli.py` passing `forwarded_allow_ips` — uvicorn trusts only `127.0.0.1` and Traefik dials from a bridge IP.
- Sessions are **per-device**. Signing in elsewhere no longer signs this one out.
- Support "View as" does not carry a session across hosts. It mints a single-use, 60-second hand-off token (`schema/migrations/002_support_handoff.sql`), passed in a **URL fragment** so it never reaches a server log, and `POST /v1/session/handoff` exchanges it for a 45-minute impersonating session on `app.`. Stop ends that session and returns to the console.
- `effective_org_id()` in `accounts.py` is **the only supported way** to resolve the org a request operates on. The raw field is named `session_org_id` so a direct read is a loud miss, and a test fails the build if anything outside `accounts.py` touches it. Product modules: use the accessor.

## Gates

`scripts/test.sh` runs `ruff check`, `ruff format --check`, then pytest (54).
`make ci` and `make ci-e2e` run exactly what CI runs — the workflow calls those
same two scripts and contains no gate logic of its own, so the two cannot drift
and a provider outage does not leave you merging on faith.
`pnpm e2e` runs the browser suite in `e2e/` against a live stack — the layer the
other two cannot reach. Keep the boundary: adapter behaviour in pytest, what a
browser does in `e2e/`, and `smoke.sh` stays a small HTTP check of a live install. CI also builds all three frontends and one frontend image, which is what catches drift in the hardcoded importer list in `deploy/docker/frontend.Dockerfile`.

`smoke.sh` validates TLS against the system trust store (`curl` without `-k`), so it doubles as the trust check. `capture-ui.sh` asserts sign-in out of band — `agent-browser` exits 0 on a failed step, so an in-batch check cannot fail it.

**`make ci-e2e` cannot pass on this workstation**, for a reason that has nothing to do with the code — every click times out. Do not chase it here and do not treat a red `ci-e2e` as a review finding until you have read *Open, and owned by the operator* below. `make ci` is unaffected and is the gate to run.

When you add a guard, prove it fails: plant a violation, watch it reject, remove it. Three guards in this repo's history passed while testing nothing.

## Exploring by hand (or by agent)

`./harness/scripts/qa.sh` stands up a live install an agent can poke mid-task —
signed in as a persona, and optionally **carrying state**: `--taint legacy-cookie`
is PR #9's duplicate-cookie shape in one flag, `--taint carry` reopens whatever
the last run left. That is the blind spot every gate above shares, since all of
them start from an empty browser. Headless by default; `--headed` for a window and
`qa.sh watch` to hand the live session to a person. Protocol: `harness/qa.md`.
It is **not** a gate and never runs in CI — a finding worth keeping becomes an
`e2e/` spec or a pytest case.

## Judging the design

`./harness/design/bin/design` is the pass over the whole product rather than one
screen. `design sense` measures every surface in `design.config.json` — contrast
per colour pair, WCAG 2.2 target sizes, type scale, palette, spacing grid, layout
breaks, the heading ladder as rendered, and the tells that make a page look
generated — and costs nothing. `design panel` then puts the pixels to three
critics on three vendors' models, an adversary that tries to kill each finding,
and an arbiter; it costs money per call and is never a gate. `design diff`
compares two runs without asking anyone's opinion. Protocol:
`harness/design/PROTOCOL.md`, decided in ADR-0015.

The harness is deliberately decoupled: `design.config.json` at the root is the
only file that names a host, a route, a persona or the product, and
`design selftest` (63 assertions against planted fixtures, run from a scratch
directory) fails if the tree learns a second seam. To use it in another repo,
copy `harness/design/` and write one profile.

What its first real pass found here, still unfixed: the input border is
**1.26:1** against its surface on every form (`web-signin`, `web-signup`,
`web-account`, `admin-signin`) where WCAG 1.4.11 wants 3:1 — one shadcn token,
six fields on the account page alone; muted body copy on `web-account` at
**3.99:1** against 4.5:1; and no `<main>` landmark on any signed-in surface.

**On this workstation** the browser never presents a frame, so `design` captures
by printing the page and rasterising it instead, and stamps the run
`print-fallback` everywhere it is read. Same cause as the browser gate being
unrunnable here — see *Open, and owned by the operator*.

**What nobody has exercised yet.** `design panel` has never been pointed at this
product; only `design sense` has. The panel was proven against the harness's own
fixtures and only through its `identity` lens, so `craft` and `usability` ship as
prompts no model has run. The `axe` and `vitals` sensors are wired, opt-in, and
have never returned anything here, because both need the page to paint. Four
unproven things: say so if you use them, and prove them before you trust them.

## Asking the other two agents

`./harness/scripts/peer.sh` is the channel between Claude, Codex and Grok, all
three installed here and all three headless-capable. `ask` delegates, `review`
reads a diff against a fixed schema, `audit` puts one claim as confirmed /
refuted / unproven, and `duel` is a blind review by both peers followed by each
judging the other's claims. Every call leaves an exchange in
`harness/peer/exchanges/` — request, answer, argv, cost — so a third agent can
replay it. Reviewers are read-only and the harness proves it by photographing the
tree, because Grok's permission modes do not block writes (its `--sandbox
read-only` does). Not a gate, never in CI, and billed per call: budget minutes for
a duel. Protocol: `harness/peer.md`. → ADR-0014.

## Next (not started)

- Product module in `modules/` when there is a sold job
- **Three findings against this build, raised by `design sense` and none of them fixed.** The input border sits at **1.26:1** against its surface where WCAG 1.4.11 wants 3:1 — that is one shadcn token and it is every form in the product, six fields on the account page alone. Muted body copy on `web-account` is **3.99:1** against 4.5:1. No signed-in surface has a `<main>` landmark, so skip-to-content has nowhere to go. Evidence: run `20260817-150605`, and `design sense` reproduces it in about three minutes.
- **Find out whether the browser gate can be made to run here at all.** Untried levers are in *Open, and owned by the operator*: `--headless=old`, a real display (WSLg or Xvfb with a headed launch), a different WSL kernel. Worth an hour because it currently costs every browser-shaped tool on this machine, not just `ci-e2e`.

## Later — component lab (do not do now)

When `@hull/ui` has a real catalog (Shell, Button states, empty, toast) **then** add Storybook and consider **Chromatic** for component visual regression on PRs. It has `button`, `confirm-dialog`, `input`, `label`, `sonner` plus shell/brand/theme — not a catalog yet.

Until then: agent-browser + PNG judgment. After a look we like: `agent-browser diff screenshot --baseline` locally. Not Chromatic on full pages.

## Do not rebuild

Org isolation, Traefik-in-compose, `config.json` runtime brand, and the session model as described above — auth and the cookie were rebuilt deliberately in PRs #3, #5 and #9. Read that section before changing either.

## Open, and owned by the operator

- `capture-ui.sh` sets `AGENT_BROWSER_IGNORE_HTTPS_ERRORS`, so it cannot tell a trusted certificate from an untrusted one. Left as is: judging pixels and testing TLS are different jobs, and `smoke.sh` already covers the second.
- The CA on this workstation was rotated to a name-constrained one. A fresh clone gets constraints on first issue; an older install is detected and told how to rotate.
- **Headless Chrome never presents a frame here, and that takes the browser gate with it.** Measured 2026-08-17. `requestAnimationFrame` is never called back — a promise waiting on one still has not resolved after three seconds. Playwright's actionability check waits for an element's box to be unchanged across **two consecutive animation frames** before it will click, so on this host every click waits out its timeout: `pnpm e2e` failed 12 of 13, each at exactly 35s, all with `waiting for element to be visible, enabled and stable`. The one that passed is the only one that never clicks — it drives the API and asserts visibility.

  It is the machine, not Hull. Reproduced against a page with no Hull code, no JS, no CSS and no network in it:

  ```
  pnpm --filter @hull/e2e exec node -e '
  const { chromium } = require("@playwright/test");
  (async () => {
    const b = await chromium.launch(); const p = await b.newPage();
    await p.setContent("<button id=b style=\"width:200px;height:60px\">click me</button>");
    console.log(await p.evaluate(() => Promise.race([
      new Promise(r => requestAnimationFrame(() => r("rAF fired"))),
      new Promise(r => setTimeout(() => r("rAF NEVER fired in 3000ms"), 3000))])));
    try { await p.click("#b", { timeout: 8000 }); console.log("clicked"); }
    catch (e) { console.log("click timed out"); }
    await b.close();
  })();'
  ```

  Same defect, same day, in three other places: `Page.captureScreenshot` times out (so `capture-ui.sh` produces no PNGs and `design` falls back to printing), and `agent-browser a11y` and `agent-browser vitals` both hang, because axe and the vitals probe need the page to paint. `Page.printToPDF` takes a different path through the renderer and works, which is the whole reason the design harness can still see anything.

  Tried and did not fix it: `--disable-gpu`, `--disable-software-rasterizer`, a second Chromium build (Playwright's 1237 as well as system Chrome), fresh browser sessions, and `agent-browser doctor`, which reports every check passing including its own headless launch test. **Not tried:** `--headless=old`, a real display (WSLg or Xvfb with a headed launch), or a different WSL kernel — that is where to start.

  Until it is fixed, the browser layer is only verifiable in GitHub Actions, where it has been green. Nothing in the repo works around this, and nothing should: a suite that passes by skipping every click would be worse than one that cannot run.
