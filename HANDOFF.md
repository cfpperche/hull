# Hull handoff

**Date:** 2026-08-17  
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
- **Account management, three of four pieces.** Password reset, email verification, and changing the address you sign in with — all on the single-use token pattern `support_handoffs` established: hashed at rest, `used_at IS NULL … RETURNING`, token in the URL fragment. Migrations `003`, `004` and `005`. That closes the lifecycle ADR-0011 was about — see *Next* for the one piece that is left

## How the session works now

Changed by the review — the old notes here described the previous model.

- The cookie is **host-scoped**. `app.` and `admin.` hold separate sessions; signing out of one does not touch the other. It carries `Secure`, which depends on `cli.py` passing `forwarded_allow_ips` — uvicorn trusts only `127.0.0.1` and Traefik dials from a bridge IP.
- Sessions are **per-device**. Signing in elsewhere no longer signs this one out.
- Support "View as" does not carry a session across hosts. It mints a single-use, 60-second hand-off token (`schema/migrations/002_support_handoff.sql`), passed in a **URL fragment** so it never reaches a server log, and `POST /v1/session/handoff` exchanges it for a 45-minute impersonating session on `app.`. Stop ends that session and returns to the console.
- `effective_org_id()` in `accounts.py` is **the only supported way** to resolve the org a request operates on. The raw field is named `session_org_id` so a direct read is a loud miss, and a test fails the build if anything outside `accounts.py` touches it. Product modules: use the accessor.
- **Four token tables, one shape.** `support_handoffs`, `password_resets`, `email_verifications` and `email_changes` are hashed at rest and claimed with `UPDATE … WHERE used_at IS NULL AND expires_at > now() … RETURNING`, so two clicks on one link cannot both win. Their links carry the token in the **fragment**, which is never sent to a server: not in an access log, not in a `Referer`. `/reset`, `/verify` and `/email` strip it during the first render, not in an effect — an effect runs after paint and leaves it in the address bar for a frame. Copy this shape rather than inventing a fifth.
- Password reset ends **every** session of that user; a reset is what someone does when they believe an attacker holds one. Verification and an email change end nothing: the first grants nothing, and the second is a deliberate edit that would otherwise sign you out of the laptop because you finished on your phone.
- `email_verifications` stores **the address the link was sent to**, not just the user, so a link minted before an address change cannot confirm the address that replaced it. That column now earns its keep, and `test_email_change.py` walks both layers: the change spends the stale link outright, and with the row un-spent by hand the stored address still refuses it.
- **Changing the email is a move, not an edit.** The password is confirmed when the change is *asked for* — that is the step a stolen cookie reaches. Nothing changes until the new address redeems its own link; until then the old one still signs in and still gets reset mail. The old address is mailed twice, and **changing the password cancels every pending change**, which is what makes "if this was not you, change your password" a control rather than advice.

## Gates

`scripts/test.sh` runs `ruff check`, `ruff format --check`, then pytest (73).
`e2e/` holds 14 browser specs. Keep the split the three mail flows use: what only
a browser shows goes in `e2e/`, and single use, expiry, collisions and the
enumeration guard stay in pytest — cheaper, deterministic, and they do not spend
credential calls out of the suite's shared rate-limit budget. Each of those flows
is one browser spec against ten to nineteen server tests, and that ratio is the
target, not an accident.
`make ci` and `make ci-e2e` run exactly what CI runs — the workflow calls those
same two scripts and contains no gate logic of its own, so the two cannot drift
and a provider outage does not leave you merging on faith.
`pnpm e2e` runs the browser suite in `e2e/` against a live stack — the layer the
other two cannot reach. Keep the boundary: adapter behaviour in pytest, what a
browser does in `e2e/`, and `smoke.sh` stays a small HTTP check of a live install. CI also builds all three frontends and one frontend image, which is what catches drift in the hardcoded importer list in `deploy/docker/frontend.Dockerfile`.

`smoke.sh` validates TLS against the system trust store (`curl` without `-k`), so it doubles as the trust check. `capture-ui.sh` asserts sign-in out of band — `agent-browser` exits 0 on a failed step, so an in-batch check cannot fail it.

**`make ci-e2e` cannot pass on this workstation**, for a reason that has nothing to do with the code — every click times out. Do not chase it here and do not treat a red `ci-e2e` as a review finding until you have read *Open, and owned by the operator* below. `make ci` is unaffected and is the gate to run.

When you add a guard, prove it fails: plant a violation, watch it reject, remove it. Four guards in this repo's history passed while testing nothing — the most recent was the email-change browser spec, which moved the address to `moved-${user.username}@host` and then asserted on the *old* one with a substring text match. That string contains the old address, so the assertion was true either way and the spec passed with the change wrongly applied at request time. If a test compares two identifiers, make sure they cannot contain each other, and prefer `toHaveText` on a testid over `getByText`.

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

**The programme is account management, one piece at a time: build it, drive it in
a browser, then take the next.** Three are done, one is left.

- **See and revoke sessions — take this one next.** The `sessions` table has been
  per-device since PR #5 and nothing surfaces it: a user cannot see where they are
  signed in, and cannot end a session on a laptop they no longer have. There is no
  `/v1/me/sessions` in the adapter or the contract. It is the last piece and the
  cheapest — a list and a delete, no mail and no new token table — but it needs
  two things the row does not carry yet: something to recognise a device by, and
  which row is *this* one, so the list can say "current" and revoking the others
  does not sign you out of the browser you are looking at. That means a small
  migration (a user agent string and a last-seen timestamp, written on use) rather
  than a pure read. Sessions are already swept on sign-in when expired, so the
  list only ever shows live rows. Watch the write cost: stamping `last_seen_at` on
  every authenticated request turns each one into a write, so round it — a minute
  of granularity is plenty for a list a human reads.
- Product module in `modules/` when there is a sold job
- **Three findings against this build, raised by `design sense` and none of them fixed.** The input border sits at **1.26:1** against its surface where WCAG 1.4.11 wants 3:1 — that is one shadcn token and it is every form in the product, six fields on the account page alone. Muted body copy on `web-account` is **3.99:1** against 4.5:1. No signed-in surface has a `<main>` landmark, so skip-to-content has nowhere to go. Evidence: run `20260817-150605`, and `design sense` reproduces it in about three minutes.
- **Repair the browser on this workstation.** The cause is now narrowed: Chrome's separate GPU process never comes up, and `--in-process-gpu` or a headed launch both dodge it — in Playwright *and* in `agent-browser`, via `AGENT_BROWSER_ARGS`. See *Open, and owned by the operator* for the measurements. What is left is the actual repair, most likely a `wsl --shutdown` and, failing that, `--headless=old` or a different WSL kernel. Worth an hour because it costs every browser-shaped tool here, not just `ci-e2e`.

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

  Tried and did not fix it: `--disable-gpu`, `--disable-software-rasterizer`, a second Chromium build (Playwright's 1237 as well as system Chrome), fresh browser sessions, and `agent-browser doctor`, which reports every check passing including its own headless launch test. **Not tried:** `--headless=old`, or a different WSL kernel.

  **One lever does work, and it names the culprit: `--in-process-gpu`.** Measured 2026-08-17 with all three of `--disable-gpu --disable-software-rasterizer --in-process-gpu`: `Page.captureScreenshot` returns, and `pnpm e2e` went from 12-of-13 failing at 35s each to **13 passing in 9.6s**, three runs out of four. So it is Chrome's *separate* GPU process failing to come up, not the renderer or the code — `--disable-gpu` alone is not enough because it still spawns one. A headed launch works for the same reason and is the other half of the evidence: `agent-browser --headed` screenshots fine.

  Reconfirmed 2026-08-17 while building the email change, and the lever now has a second half: **`agent-browser` takes the same flags through `AGENT_BROWSER_ARGS`**, so the QA and visual harnesses recover too. Without it `qa.sh look` dies on `CDP command timed out: Page.captureScreenshot`; with `AGENT_BROWSER_ARGS="--disable-gpu,--disable-software-rasterizer,--in-process-gpu"` exported before `qa.sh start`, screenshots come back. That is the same fault answering to the same lever in a second tool, which is about as confirmed as this gets without repairing the machine.

  It is a diagnosis, not a fix, and it is deliberately **not** in `playwright.config.ts`. CI runs on a clean `ubuntu-latest` where the default works, and tuning the repo around one broken workstation is how a suite ends up passing for reasons nobody can name. Use it ad hoc to get real signal on a spec you are writing, then take it back out: keep the config in a scratch directory with an absolute `testDir` and run `playwright test -c <that>`. Bare `make ci-e2e` on this host today: 13 of 14 failed in 7.8 minutes. The same suite with the flag: 14 passed in 8.9s, repeatedly. Even so the signal here is indicative, not a gate — an earlier session saw one run in four lose two tests with the flag on.

  Until it is fixed, the browser layer is only verifiable in GitHub Actions, where it has been green. Nothing in the repo works around this, and nothing should: a suite that passes by skipping every click would be worse than one that cannot run.
