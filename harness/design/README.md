# design — a multi-agent harness for frontend and design work

Points a browser at a running frontend, measures what can be measured, and puts
what is left in front of several agents with different jobs: one that judges
craft, one that judges usability, one that judges whether the thing looks like
*your* product or like every product, and adversaries whose job is to kill their
findings. It leaves evidence on disk, so the next agent can check the last one.

It knows nothing about your project. One profile file is the entire seam.

```bash
harness/design/bin/design doctor      # what is installed, what works here
harness/design/bin/design sense       # pixels + measurements + deterministic findings
harness/design/bin/design panel       # the judgment layer, on that evidence
harness/design/bin/design review      # both, then a report
harness/design/bin/design selftest    # prove the detectors fire, and that this tree is portable
```

Read **`PROTOCOL.md`** before writing a finding. It is normative: what the stages
are, what the bias controls are, and what counts as a finding rather than a
rumour.

## Install

- **`jq`** — required.
- **`agent-browser`** — the default driver. `npm i -g agent-browser && agent-browser install`.
- **`ghostscript`** — optional, only used as a capture fallback (see *degrade* below).
- **At least one agent CLI** for the panel: `claude`, `codex`, `grok`. `sense`
  needs none of them.

Nothing else. No test runner, no framework plugin, no CI service.

## The profile

Drop `design.config.json` at your project root. Its directory becomes the project
root for everything the harness writes.

```json
{
  "project": "acme",
  "sector": "b2b billing console",
  "out": ".design/runs",

  "brand":      { "accent": "#0f6d4d", "type": "Söhne", "voice": "plain, no superlatives" },
  "benchmarks": { "copy": ["Stripe", "Linear"], "refuse": ["violet gradient hero", "six stat cards"] },

  "viewports": [
    { "name": "desktop", "width": 1440, "height": 900 },
    { "name": "mobile",  "width": 390,  "height": 844 }
  ],

  "auth": {
    "member": [
      { "open": "https://app.${APP_HOST}/signin" },
      { "fill": { "testid": "auth-email" },    "value": "${DEMO_USER}" },
      { "fill": { "testid": "auth-password" }, "value": "${DEMO_PASSWORD}" },
      { "click": { "testid": "auth-submit" } },
      { "wait": "networkidle" },
      { "assert": "[data-testid=user-menu]" }
    ]
  },

  "surfaces": [
    { "name": "marketing", "url": "https://${APP_HOST}/" },
    { "name": "home", "url": "https://app.${APP_HOST}/", "auth": "member",
      "assert": "[data-testid=user-menu]", "mask": [".live-clock"] }
  ],

  "budgets": { "typeScaleMax": 6, "fontFamiliesMax": 2, "radiiMax": 4, "slopWeightMax": 4 },
  "panel":   { "refuters": 1, "quorum": 1 },
  "selftest": { "denyTokens": ["acme"] }
}
```

Every string may contain `${VAR}` or `${VAR:-default}`, taken from the
environment. Hosts and credentials therefore stay in your `.env` and the profile
in git holds the shape, not the secret.

| Key | What it does |
|---|---|
| `project`, `sector` | identity, and the sector the critics judge against |
| `brand`, `benchmarks` | **the contract** — what you copy, what you refuse. The identity lens judges against this, not against its own taste |
| `surfaces[]` | `name`, `url`, optional `auth` persona, `assert` selector, `mask` selectors, `viewports` subset |
| `auth.<persona>[]` | driver-neutral steps: `open`, `fill`, `click`, `press`, `hover`, `wait`, `eval`, `cookies`, `assert` |
| `budgets` | where a *fact* becomes a *defect* for this project |
| `sensors[]` | which sensors run; default is every in-page one plus `console` |
| `panel` | `runtimes`, `assign`, `refuters`, `quorum` |
| `selftest.denyTokens` | words that must never appear inside the harness. This is how the portability test names your project without the harness containing it |

`assert` matters more than it looks. `agent-browser` exits 0 on a failed step, so
without it a persona that silently failed to sign in produces a set of
screenshots of the login page, filed under the names of the pages behind it, and
a panel then reviews the login page as if it were the product. A surface whose
assertion fails is dropped from the evidence and named in the report.

## What it measures

In-page, no dependencies, at every viewport:

| Sensor | What it produces |
|---|---|
| `census` | type scale, families, weights, radii, shadows, spacing grid, palette, the heading ladder as *rendered* |
| `contrast` | WCAG 2.2 text contrast per colour pair, plus control-boundary contrast |
| `semantics` | names, labels, heading order, landmarks, `lang`, duplicate ids, focus suppression, positive tabindex |
| `targets` | WCAG 2.2 target size, with the inline-text and spacing exceptions implemented |
| `overflow` | sideways scroll, clipped and untitled-truncated text, overlapping text boxes |
| `slop` | the measurable distributional tells — violet accent, cool gradient, glass, the 4px left strip, the three-card row, badge-above-headline, emoji icons |
| `runtime` | layout shift, LCP, failed sub-resources, weight, DOM size |
| `console` | what the page threw while you were looking at it |

Optional, when the driver offers them and the host can paint: `axe` (axe-core,
and it wins over the in-page subset it covers) and `vitals`.

The split to keep in mind: **a sensor reports what is true, a rule decides what is
wrong.** Eleven type sizes is a fact everywhere; whether eleven is a defect is
your `budgets`. That is why this tree survives being copied into a project with
different taste.

## Degrade, loudly

Nothing here silently produces less than it claims:

- **No screenshot?** Some headless hosts never hand over a frame and
  `Page.captureScreenshot` hangs. The driver falls back to a print render
  (`printToPDF` → ghostscript → PNG), stamps the run `print-fallback`, and the
  report and the panel prompt both say the width is not the viewport width.
- **No agent CLI?** `sense` still runs and still reports. `panel` says what it
  skipped.
- **A runtime that cannot see images?** It never gets a visual lens. It gets
  refutation and the DOM-side usability lens instead.
- **A surface that would not load?** It is not in the evidence, and the report
  says so under *what this run could not see*.

`design doctor` probes the host and prints this map before you spend anything.

## Using it in a loop

```bash
design sense                       # before
# … make the smallest change the report justifies …
design sense                       # after
design diff --before <stamp> --after last
```

`diff` is deliberately model-free: measured numbers side by side, which
deterministic findings disappeared, which are new. "Is it better now", answered
by the same family that proposed the change, is not evidence.

## Portability

`design selftest` is the guard. It greps the tree for absolute paths, for
anything reaching above the harness root, and for the words your profile declares
as yours — then runs the entire deterministic pipeline from a scratch directory,
against the fixtures, with no project present. To adopt it elsewhere: copy the
directory, write one profile.
