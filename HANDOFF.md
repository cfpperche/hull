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
- **The mail carries the design.** Six transactional messages, `multipart/alternative`, bodies written as react-email JSX in `packages/email` and rendered at build time into the adapter. No runtime editor and no Node behind SMTP — see *Mail* below
- **Account management, all four pieces.** Password reset, email verification, changing the address you sign in with, and seeing and revoking sessions. The first three share the single-use token pattern `support_handoffs` established: hashed at rest, `used_at IS NULL … RETURNING`, token in the URL fragment. Migrations `003` to `006`. That closes the lifecycle ADR-0011 was about; a user can now do everything to their own account except delete a workspace they share

## How the session works now

Changed by the review — the old notes here described the previous model.

- The cookie is **host-scoped**. `app.` and `admin.` hold separate sessions; signing out of one does not touch the other. It carries `Secure`, which depends on `cli.py` passing `forwarded_allow_ips` — uvicorn trusts only `127.0.0.1` and Traefik dials from a bridge IP.
- Sessions are **per-device**. Signing in elsewhere no longer signs this one out.
- Support "View as" does not carry a session across hosts. It mints a single-use, 60-second hand-off token (`schema/migrations/002_support_handoff.sql`), passed in a **URL fragment** so it never reaches a server log, and `POST /v1/session/handoff` exchanges it for a 45-minute impersonating session on `app.`. Stop ends that session and returns to the console.
- `effective_org_id()` in `accounts.py` is **the only supported way** to resolve the org a request operates on. The raw field is named `session_org_id` so a direct read is a loud miss, and a test fails the build if anything outside `accounts.py` touches it. Product modules: use the accessor.
- **Four token tables, one shape.** `support_handoffs`, `password_resets`, `email_verifications` and `email_changes` are hashed at rest and claimed with `UPDATE … WHERE used_at IS NULL AND expires_at > now() … RETURNING`, so two clicks on one link cannot both win. Their links carry the token in the **fragment**, which is never sent to a server: not in an access log, not in a `Referer`. `/reset`, `/verify` and `/email` strip it during the first render, not in an effect — an effect runs after paint and leaves it in the address bar for a frame. Copy this shape rather than inventing a fifth.
- Password reset ends **every** session of that user; a reset is what someone does when they believe an attacker holds one. Verification and an email change end nothing: the first grants nothing, and the second is a deliberate edit that would otherwise sign you out of the laptop because you finished on your phone.
- `email_verifications` stores **the address the link was sent to**, not just the user, so a link minted before an address change cannot confirm the address that replaced it. That column now earns its keep, and `test_email_change.py` walks both layers: the change spends the stale link outright, and with the row un-spent by hand the stored address still refuses it.
- **Sessions are visible and revocable**, and none of it takes a password: revoking only ever removes access, so a credential in front of it makes the safe action the slow one. Ownership lives *inside* the delete (`WHERE id = %s AND user_id = %s`), not in a check around it — the id is in the URL and is not a secret. A row is recognised by its `User-Agent`, read by a dumb matcher in `accounts._device_label`, and by `last_seen_at`, which `_touch_session` writes at most once a minute. Do not remove that guard: `load_session` runs on every authenticated request, so without it every GET is a write.
- **Changing the email is a move, not an edit.** The password is confirmed when the change is *asked for* — that is the step a stolen cookie reaches. Nothing changes until the new address redeems its own link; until then the old one still signs in and still gets reset mail. The old address is mailed twice, and **changing the password cancels every pending change**, which is what makes "if this was not you, change your password" a control rather than advice.

## Mail

Six messages: welcome, password reset, verification resend, and the three that
carry an address change. Every one is `multipart/alternative`.

- **The plain half is not a courtesy.** It is what a text-only client shows and
  what deliverability rests on, and its wording is the one this install has
  always sent. The HTML is an alternative, never a replacement — order matters,
  because a client takes the last part it understands.
- **Bodies are react-email JSX in `packages/email`.** `pnpm --filter @hull/email
  build` renders them **once per locale** into
  `adapters/fastapi/src/hull_fastapi/mail_templates/` — `password-reset.pt-BR.html`,
  `.txt` and `.subject`, seven messages × two languages × three parts — with
  `{{name}}` where a value goes; `mail_compose` fills the holes at send. React is
  not in the request path, and neither is any translation: choosing a language
  here is choosing a filename. Preview with `pnpm --filter @hull/email dev` on
  :3300, which is why every template defaults its catalog.
- **The language is the recipient's, never the caller's.** An operator working in
  English who triggers a notice to a Brazilian customer sends it in Portuguese.
  There is no browser on the receiving end to ask, which is the whole reason
  `users.locale` is a column. The two mails that arrive with no session — the
  reset and the "your email was changed" notice — read it with
  `accounts.user_locale(conn, email=…)`.
- **The subject travels with the body.** It used to be built in `Settings`, which
  put one half of every message in Python and the other in the JSX. A subject
  promising what the body no longer says is exactly the drift nobody notices,
  because the two are only ever read together in an inbox.
- **That directory is generated. Do not hand-edit it.** `pnpm --filter @hull/email
  check` runs in `ci.sh` and fails when it has drifted from the JSX.
- **Three build-time guards, and they are not the same hole.** A placeholder not
  declared in `src/vars.ts` fails the build, because a mistyped `{{lnk}}` is
  delivered literally in the mail whose only job is to carry a URL. A *catalog*
  hole — `{oldEmail}` — that the JSX never gave a value to fails it too. And a
  known `{{hole}}` nobody passed a value for is caught by `test_mail_design.py`,
  which now runs every design assertion once per locale: a second language is a
  second set of generated files, and "the English one is safe" says nothing
  about them.
- **The two layers of hole nest, and getting that wrong is silent.** A catalog
  string is filled at build time with values that are themselves `{{holes}}` for
  the adapter. `segments()` in `@hull/i18n` must not cut inside a doubled brace —
  when it did, React put its comment separators between the pieces and the
  generated HTML carried `{<!-- -->{brand}<!-- -->}`, a hole `mail_compose` can
  no longer see. Caught by a test, in a message that had already rendered
  cleanly.
- **No runtime editor, deliberately.** An install that can rewrite its own
  password-reset mail while running has a new way to lose account recovery. If
  that changes, it is an ADR — and the template language would need to stay a
  substitution rather than becoming a language.
- **Why the HTML looks the way it does.** Tokens are hex because
  `packages/ui/src/styles.css` states them in `oklch()`, which Gmail drops and
  Outlook never parsed; styles are inline and layout is tables because clients
  strip `:root`; there is one light design because `prefers-color-scheme` works in
  Apple Mail and almost nowhere else; the brand mark is a drawn letter because a
  hosted logo is blocked by default and arrives as a broken icon. White-label
  still reaches it — brand, mark and host come from Settings (ADR-0006).
- **The two warnings have no button.** The mails to the address losing an account
  go to somebody who may not have asked for anything, and a one-click action in a
  "was this you?" mail teaches the reflex phishing depends on.

### The console has its own account page

Decided rather than drifted: `apps/admin` gained `/account` instead of the bounce
being relaxed. A `platform_admin` on `app.` is still sent back here, because that
redirect is a domain rule — an operator has no workspace, so the product would
hand them the "name your first workspace" screen — and relaxing it to save one
screen is the erosion the Locks section exists to stop.

The sections are shared through `@hull/ui` (`ProfileForm`, `EmailSection`,
`PasswordForm`, `SessionList`), each taking the client as a prop so neither
package imports the other's. That is shell, not product: Hull *is* the shell, and
`ThemePreference` is the precedent.

The console's page has no **Close account** — `close_account` refuses a
`platform_admin`, so the button would exist only to answer 403. There is a
browser test asserting its absence.

## Gates

`scripts/test.sh` runs `ruff check`, `ruff format --check`, then pytest (133).
`e2e/` holds 18 browser specs, pinned to `en-US` in `playwright.config.ts` —
several find a control by the words on it, and without the pin a developer whose
machine is set to Portuguese would watch the suite fail for a reason unrelated to
the code. Keep the split the three mail flows use: what only
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

**Before blaming the browser, check the API.** A 500 from the adapter produces the
*exact* signature the GPU fault does: every spec times out at 30s on
`waiting for element to be visible, enabled and stable`, and a whole suite takes
seven minutes. It cost a while to spot on 2026-08-17, when the stack was rebuilt
with `build-images.sh` and restarted directly — which skips the migration
`up.sh` runs — so new code met an old `sessions` table. Two seconds of
`docker logs hull-api --tail 5` says which it is. Restart the stack with
`./scripts/up.sh`, not `docker compose up -d`, and this cannot happen.

**Green here is not green in CI, and the difference is the test database.**
`hull_test` is never dropped — `scripts/test.sh` reuses the container and only
re-runs migrations — so rows survive between runs and across branches. CI starts
empty, and it migrates with `HULL_SEED_DEMO=0`, so **`ada@hull.test` and
`admin@hull.test` do not exist there.** A test that signs in as either passes
here and fails on the runner. That is exactly how the sessions merge went red:
`test_a_support_session_is_named_as_one` borrowed the seeded admin and was
sitting on a row an earlier session had left behind.

Before trusting any test that touches a seeded account, reproduce the runner:

```bash
PGPASSWORD=hull psql -h 127.0.0.1 -p "${HULL_TEST_PG_PORT:-55434}" -U hull -d hull_test \
  -c "DELETE FROM users WHERE lower(email) IN ('ada@hull.test','admin@hull.test');"
./scripts/test.sh          # expect 1 skipped — the lab-seed test guards itself
```

Better still, do not borrow them. `test_handoff.py::_admin` signs up an account
and promotes it with one UPDATE; copy that. The only fixture allowed to *assume*
the seed is the one that calls `pytest.skip` when it is missing.

**And read the run, do not just start it.** `gh run watch` can be killed and
leave you believing a push was green. `gh run list --limit 1` after it finishes
is the check that costs nothing.

When you add a guard, prove it fails: plant a violation, watch it reject, remove it. Five guards in this repo's history passed while testing nothing — the most recent was the email-change browser spec, which moved the address to `moved-${user.username}@host` and then asserted on the *old* one with a substring text match. That string contains the old address, so the assertion was true either way and the spec passed with the change wrongly applied at request time. If a test compares two identifiers, make sure they cannot contain each other, and prefer `toHaveText` on a testid over `getByText`. The one before that was the support-session test above, which asserted nothing on a clean database because it never got past sign-in.

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

**The account-management programme is done.** Four pieces, each built, driven in
a browser and then handed over: password reset, email verification, changing the
address you sign in with, and seeing and revoking sessions. There is no fifth
queued behind it — pick from below, or take a business trigger.

- **Fix the three accessibility findings.** They are the only known defects against
  surfaces that have already shipped, `design sense` raised them, and nobody has
  touched them. Cheapest first: the input border sits at **1.26:1** against its
  surface where WCAG 1.4.11 wants 3:1 — one shadcn token, every form in the
  product, six fields on the account page alone. Muted body copy on `web-account`
  is **3.99:1** against 4.5:1. No signed-in surface has a `<main>` landmark, so
  skip-to-content has nowhere to go. Evidence: run `20260817-150605`, and
  `design sense` reproduces it in about three minutes.
- Product module in `modules/` when there is a sold job
- **Repair the browser on this workstation.** The cause is now narrowed: Chrome's separate GPU process never comes up, and `--in-process-gpu` or a headed launch both dodge it — in Playwright *and* in `agent-browser`, via `AGENT_BROWSER_ARGS`. See *Open, and owned by the operator* for the measurements. What is left is the actual repair, most likely a `wsl --shutdown` and, failing that, `--headless=old` or a different WSL kernel. Worth an hour because it costs every browser-shaped tool here, not just `ci-e2e`.

## Later — component lab (do not do now)

When `@hull/ui` has a real catalog (Shell, Button states, empty, toast) **then** add Storybook and consider **Chromatic** for component visual regression on PRs. It has `button`, `confirm-dialog`, `input`, `label`, `sonner` plus shell/brand/theme — not a catalog yet.

Until then: agent-browser + PNG judgment. After a look we like: `agent-browser diff screenshot --baseline` locally. Not Chromatic on full pages.

## Do not rebuild

Org isolation, Traefik-in-compose, `config.json` runtime brand, and the session model as described above — auth and the cookie were rebuilt deliberately in PRs #3, #5 and #9. Read that section before changing either.

## Open, and owned by the operator

- **Docker will fill this disk, and the default configuration is why.** Hit on
  2026-08-17: 90 GB reclaimed, of which **71.7 GB was BuildKit cache alone**.
  `docker buildx inspect default` shows the reason in one line — the stock GC
  policy is derived from disk size, and on a 1 TB volume it reads
  `Max Used Space: 750.6GiB`. Nothing was misbehaving; the cache was told it
  could have three quarters of the disk and took it. `up.sh` rebuilds four
  images every run, so this repo feeds it faster than most.

  The fix is machine-wide and needs a password, so it is the operator's:
  `/etc/docker/daemon.json` gains a `builder.gc.policy` capping the cache at
  20 GB with a 20 GB free-space floor, plus `log-opts` so `json-file` stops
  growing without bound. Validate before restarting — `dockerd --validate
  --config-file=…` catches a malformed file, and `docker buildx inspect default`
  after the restart prints the policy actually in force, which is the only way
  to know it was read. Note that `--validate` checks top-level keys only: a
  typo *inside* `builder.gc.policy` passes it and is then silently ignored.

  Two things it does not cover. `docker volume prune -f` is safe — it removes
  only anonymous volumes — but **`docker volume prune -a` is not**: this machine
  carries named volumes for a dozen other projects, and `-a` deletes every one
  not currently attached to a container. And the WSL disk image never shrinks on
  its own: freeing space inside the distro leaves `ext4.vhdx` the same size on
  `C:`, so reclaiming it on the Windows side is `wsl --shutdown` then
  `diskpart` → `select vdisk file="…\ext4.vhdx"` → `attach vdisk readonly` →
  `compact vdisk` → `detach vdisk`. `.wslconfig` here already sets
  `sparseVhd=true`, which only applies to distros created after it was set —
  an existing one needs `wsl --manage <distro> --set-sparse true`.
- **WSL wipes `/etc/hosts` on every boot, and it takes the whole stack with it.**
  Hit on 2026-08-17: `smoke.sh` failed with `Could not resolve host: hull.test`,
  every browser-shaped tool was unreachable, and nothing about the code had
  changed. `/etc/wsl.conf` here has a `[network]` section but no
  `generateHosts = false`, so WSL regenerates the file and the entries
  `setup-local.sh` wrote are gone. The immediate fix is
  `sudo ./scripts/setup-local.sh`; the durable one is adding that line and
  `wsl --shutdown`. Owned by the operator because both need a password.
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

  It is a diagnosis, not a fix, and it is deliberately **not** in `playwright.config.ts`. CI runs on a clean `ubuntu-latest` where the default works, and tuning the repo around one broken workstation is how a suite ends up passing for reasons nobody can name. Use it ad hoc to get real signal on a spec you are writing, then take it back out: keep the config in a scratch directory with an absolute `testDir` and run `playwright test -c <that>`. Bare `make ci-e2e` on this host today: 13 of 14 failed in 7.8 minutes. The same suite with the flag: 15 passed in 10s, repeatedly. Even so the signal here is indicative, not a gate, and it is getting worse rather than better — **five of ten full runs with the flag on lost a test**, a different spec each time, always in a run that took 20–40s instead of 10s. Zero server errors in `hull-api` across all ten, which is how you tell this from the API-500 signature above. A single spec re-run in isolation has passed every time. Treat a lone failure here as unproven and re-run it; treat a whole suite failing at 30s each as either this or a 500, and check the log before deciding which.

  Until it is fixed, the browser layer is only verifiable in GitHub Actions, where it has been green. Nothing in the repo works around this, and nothing should: a suite that passes by skipping every click would be worse than one that cannot run.
