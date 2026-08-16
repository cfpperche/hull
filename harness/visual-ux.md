# Visual UX harness

Agents: read **`harness/benchmarks.md`** for the sector in play before restyling. Research is not a screenshot substitute.

You cannot judge layout, type, spacing, or slop from HTML or from an accessibility snapshot. **Pixels are required.**

## Driver

**agent-browser** (Vercel Labs). Not Playwright MCP. Not Playwright CLI for this loop.

| Job | How |
|---|---|
| Drive | `agent-browser` (`snapshot`, `@eN`, `find testid`) |
| See | `read_file` on PNGs this loop writes |
| Annotate | `agent-browser screenshot --annotate` |
| Local regression (after a look we like) | `agent-browser diff screenshot --baseline …` |
| Art / mood only | `image_gen` as reference, never as the product UI |

Skill for the CLI: `agent-browser skills get core --full` (ships with the binary). Judgment skill: `.grok/skills/visual-ux/`.

## Capture

Stack must be up (`./scripts/up.sh`). Hosts + CA: `sudo ./scripts/setup-local.sh`.

```bash
./harness/scripts/capture-ui.sh
```

Writes `harness/visual/current/` (overwritten every run):

| File | What |
|---|---|
| `www-desktop.png` / `www-mobile.png` | Marketing |
| `web-signin-desktop.png` / `web-signin-mobile.png` | App, logged out |
| `web-signup-desktop.png` | Signup |
| `web-home-desktop.png` / `web-home-desktop-ann.png` | App, Ada signed in |
| `web-account-desktop.png` | Account |
| `admin-signin-desktop.png` | Admin door |
| `admin-home-desktop.png` | Admin, signed in |
| `admin-users-desktop.png` / `admin-orgs-desktop.png` | Admin lists |

Then **`read_file` each PNG**. A list of paths is not a review.

One-off (same session):

```bash
export AGENT_BROWSER_IGNORE_HTTPS_ERRORS=1
export AGENT_BROWSER_SESSION=hull-visual
agent-browser open https://app.hull.test/signin
agent-browser set viewport 1440 900
agent-browser screenshot harness/visual/current/custom.png
```

**Evidence:** copy named shots to `harness/visual/evidence/` (gitignored). Do not commit PNGs.

## Rubric (write findings before editing)

1. Hierarchy — primary action in 2 seconds?
2. Density — product surface or form dump?
3. Type — too many sizes/weights?
4. Contrast / chrome — muddy panels, rainbow pills?
5. Alignment / spacing
6. States — empty, error, toast after write?
7. Mobile — stacked or crushed?
8. Slop — Inter+purple, glass, giant radius, generic dashboard

## Edit loop

1. Capture + `read_file` (before).
2. Rubric (what is wrong, where).
3. Smallest CSS/HTML/copy change.
4. Recapture + `read_file` (after).
5. Stop when the PNGs justify the claim.

## Not now

- Playwright MCP
- Storybook / **Chromatic** — see `HANDOFF.md` (component lab later)
- `image_gen` as the UI
