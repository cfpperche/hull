# 0015. A multi-agent design harness, decoupled from this repo, and not a gate

**Status:** Accepted  
**Date:** 2026-08-17

## Context

Judging UI in this repo has been one agent, one screenshot, one opinion.
`capture-ui.sh` takes eleven PNGs of hard-coded surfaces and `harness/visual-ux.md`
hands the reader a rubric. That got us the first visual pass, and it has three
limits that showed up as soon as the surfaces multiplied.

**The obvious defects burn the reviewer's attention.** Contrast ratios, hit-target
sizes, missing labels and sideways scroll are all things the browser can be asked
for exactly. Asking a model to eyeball them is slower, wronger at the edges, and
spends the one thing a model is uniquely good at — reading a page as a person
would — on arithmetic.

**One reviewer is one taste.** The same model that generated a screen is a poor
judge of whether the screen looks generated. By 2026 the default look of an
AI-written frontend is documented well enough to be recognised on sight: Inter, a
violet accent, a violet→blue gradient, frosted panels, a 4px coloured left border,
three feature cards in a row. A single judge asked "is this good" answers from the
same distribution that produced the page.

**And a review nobody can replay is a rumour.** Findings lived in a turn. The next
agent got prose, not evidence.

Meanwhile `capture-ui.sh` hard-codes `hull.test`, the personas, the routes and the
compose assumptions. Anything built on top of it would inherit that, and this repo
is a hull — the thing built on it is supposed to leave.

## Decision

Add `harness/design/`: a harness that measures a build, then puts what is left to
a panel of agents with different jobs. Protocol in `harness/design/PROTOCOL.md`.

**Two speeds, never merged.** `design sense` is deterministic — same page in, same
findings out, no model, no money — and can gate with `--fail-on`. `design panel`
is judgment: non-deterministic, billed per call, and never a gate. A harness that
fails a build on an opinion trains everyone to stop reading it, starting with the
half that was right.

**Sensors before judges.** Seven in-page sensors run through one `eval` per
viewport and answer with facts: type scale, palette, radii, spacing grid, WCAG
contrast per colour pair, WCAG 2.2 target sizes with the spec's exceptions,
overflow and clipping, the heading ladder as *rendered*, layout shift, failed
sub-resources, and the measurable distributional tells. The critics receive those
numbers, are forbidden to restate them, and spend their turn on what the pattern
means.

**A sensor reports what is true; a rule decides what is wrong.** Eleven type sizes
is a fact in any project. Whether eleven is a defect is `budgets` in the profile.
That line is what lets the tree be copied into a repo with different taste.

**Three lenses, an adversary, an arbiter.** `craft`, `usability` and `identity`
run independently against a rubric, on different runtimes where the machine has
them. Then a refuter is handed the findings shuffled, told to kill them, and told
to refuse when torn. The arbiter merges duplicates across lenses, ranks by harm ×
exposure × cost of the fix, and is required to *name* disagreements rather than
resolve them silently.

**A visual lens may only run on a runtime that can open an image.** Measured
2026-08-17: `claude` reads images through its file tool, `codex exec` attaches
them with `-i`, `grok` 1.0.4 has no image flag. A blind runtime handed PNG paths
does not say it cannot see them — it writes a confident critique of a page it
never looked at. Blind runtimes get refutation and the DOM-side usability lens,
where they are as good as anything else.

**No coupling to this repo.** Everything project-shaped is `design.config.json` at
the root: hosts, routes, personas, the brand, the products we copy and the
patterns we refuse, the budgets. `harness/design/` contains no host, no route, no
credential and no product name. `design selftest` proves it two ways — it greps
the tree for paths and for the words the profile declares as ours, then runs the
whole deterministic pipeline from a scratch directory against fixtures, with no
project present at all.

**Detectors are proven by planting.** `fixtures/slop.html` breaks every rule on
purpose; `fixtures/clean.html` is the same page built properly. A rule that stays
silent on the first fails the selftest, and so does one that fires on the second.
Three guards in this repo's history passed while testing nothing; this is the
answer to that.

## Consequences

A sixth thing now drives a browser here, and the boundary has to be stated or it
will rot: `e2e/` is deterministic flow coverage, `qa.sh` is exploration from a
dirty state, `capture-ui.sh` is a fast look at eleven known surfaces,
`harness/design/` is a measured pass plus a panel. `capture-ui.sh` stays — it is
one command and needs no profile — and the day its surface list and
`design.config.json` disagree, the config wins.

Runs write to `.design/runs/`, gitignored. `findings.sarif` is written in SARIF
2.1.0 so nothing downstream needs to know this harness exists.

The panel costs money per call and the brakes are blunt: `DESIGN_MAX_CALLS`,
`DESIGN_MAX_USD`, `DESIGN_TIMEOUT`. The first live run proved they bite —
a refuter and an arbiter were both cut off mid-answer by a `--max-budget-usd`
set too low, the run degraded to deterministic ordering, and the report said so
rather than presenting a partial panel as a complete one.

This machine cannot screenshot. `Page.captureScreenshot` times out under WSL2 for
every Chrome build tried, with and without the GPU, while `printToPDF` works — so
the driver falls back to printing and rasterising with ghostscript, stamps the run
`print-fallback`, and tells both the report and the critics that the width they
are looking at is paper, not the viewport. `capture-ui.sh` has the same problem
and no fallback; that is now a known gap rather than a mystery.
