# The design panel protocol

Normative. This file says how the harness decides that something is wrong with a
screen, and what an agent may claim as a result. `README.md` says how to run it.

## What this is

A harness that points a browser at a running frontend, measures what it can
measure, then asks several agents with different jobs to judge what is left —
and makes them defend it. It leaves a directory of evidence behind, so a second
agent can check the first one's work without having been there.

It is not a test suite, not a linter, and not a gate on judgment. The half of it
that *is* deterministic can gate; see below.

## Two speeds, and why they never merge

| | `design sense` | `design panel` |
|---|---|---|
| What it is | measurement | judgment |
| Repeatable | yes — same page, same findings | no |
| Costs | nothing | money, per call |
| Can fail a build | yes, with `--fail-on` | **never** |
| Wrong how | a rule with a bad threshold | a confident critique of something that is not there |

Keep the line. A harness that fails a build on a model's opinion trains everyone
to stop reading it, and the first thing they stop reading is the deterministic
half that was right.

## The pipeline

```
   observe            sensors             critics            refuters          arbiter
  ─────────         ───────────        ─────────────      ─────────────      ─────────
   drive the        measure what        judge what        try to kill        merge, rank,
   browser    →     is measurable  →    is left       →   each finding   →   name the splits
   (pixels +         (no model)         (3 lenses,        (default: no)      (1 call)
    DOM)                                independent)
```

Every stage narrows, and each exists for a reason that showed up in practice:

**Sensors before judges.** A model asked whether the contrast is acceptable will
answer, confidently, without measuring. The browser already knows the ratio.
Measuring first is cheaper, steadier and correct at the edges — and it changes
what the judges spend their attention on. Their job stops being "find the
obvious" and becomes "say what this pattern of obvious things means", which is
the part no sensor can do.

**Three lenses, not one reviewer.** One agent asked to "review this UI" produces
one blended opinion in which the accessibility failure and the mediocre spacing
carry the same weight. Split by lens — `craft`, `usability`, `identity` — and
each critic is scored against a rubric it can be held to. The lenses also fail
differently, which is the point: a redundant panel finds the same things twice.

**Refuters, defaulting to no.** A critic that finds nothing feels to a model like
a failed task, so critics reach. The cheapest correction is an adversary whose
instruction is to kill the finding and whose tie-break is refusal. Findings are
shown to it shuffled, so the order a critic produced them in cannot leak through
as a ranking.

**One arbiter, and it may not add findings.** It merges duplicates across lenses,
ranks by harm × exposure × cost of the fix rather than by severity label, and
*names* the disagreements instead of resolving them silently. A panel that hides
its splits is one model's opinion wearing a quorum's clothes.

## The roster, and the vision rule

Runtimes come from the profile (`panel.runtimes`), defaulting to whichever of the
installed CLI agents are present. Two rules govern the assignment:

1. **A visual lens may only run on a runtime that can open an image.** A blind
   runtime handed a list of PNG paths does not say "I cannot see these" — it
   writes a confident critique of a page it never looked at. Vision is declared
   per runtime and measured, not assumed.
2. **Blind runtimes still work.** They get refutation against measured numbers
   and the DOM-side usability lens, where they are as good as anything else.

Prefer a roster drawn from **different model families**. Two instances of one
model share their blind spots and their biases, and averaging them just makes
the same answer look more official.

## Bias controls

These are the failure modes that show up in every study of models judging
outputs, and what this harness does about each:

| Bias | What it looks like here | Control |
|---|---|---|
| Position | the first screenshot or the first finding gets the harshest reading | findings are shuffled per refuter; the shuffle is seedable (`--seed`) so a surprising result can be reproduced |
| Verbosity | the longest critique scores best | rubric scores each criterion independently before any comparison |
| Self-preference | a model rates its own family's work highest | critics and refuters are drawn from different runtimes wherever the machine has them |
| Drift | the same build scores differently in three months | the rubric is a file in this repo. Change it in a commit, not in a prompt, and re-score the last kept run when you do |
| Anchoring on the numbers | the critique restates the sensor output | prompts forbid restating measured facts; the refuter checks for it |

Independent per-criterion scoring is deliberate. A/B ranking ("which of these two
is better") inherits whichever order it was shown, and averaging two orders costs
twice as much as never asking the question that way.

## What counts as a finding

Same standard for a sensor and for a model. Anything short of this is a rumour:

- **A location.** A CSS selector, or a region a person can point at on a named
  screenshot. "The spacing is off" is not a finding.
- **Evidence.** The screenshot file, or the measured number. A judge that cannot
  point at either lowers its confidence or drops the claim.
- **Expected and actual.** Against the contract, a standard, or a token — not
  against the critic's taste. Preference dressed as a defect is refuted.
- **The smallest fix.** A token, a class, a removed element. Not a redesign.
- **Severity and confidence**, separately. A blocker you are 50% sure of and a
  nit you are certain of are different objects.

Findings that cannot be judged from static evidence — hover, focus, what a toast
says after a write, what the failure path does — are filed as **gaps in the
evidence** with low confidence and a note saying what capture would settle it.
They are never asserted as observed.

## Evidence on disk

One directory per run, under the project (never inside this tree):

```
<out>/<stamp>/
  meta.json              who ran it, against which commit, with which profile
  shots/<surface>@<viewport>.png
  facts/<surface>@<viewport>.json    every sensor's output, raw
  dom/<surface>.txt                  accessibility tree
  findings-sensors.json              deterministic, reproducible
  panel/<lens>-<runtime>/            request.md, the raw answer, the parsed critique
  refute/<runtime>/verdicts.json
  arbitration.json
  findings.json                      merged, after refutation
  findings.sarif                     SARIF 2.1.0
  report.md                          what a person reads
  trace.jsonl                        one span per stage, GenAI-convention names
```

Findings are files, not conversation. That is what lets a second agent replay a
first agent's finding, and what lets you diff two runs (`design diff`) instead of
arguing about whether it got better.

`findings.sarif` exists so nothing downstream has to know this harness: SARIF is
the OASIS interchange format that code-scanning surfaces, IDEs and dashboards
already read.

## Costs, and the brakes

A panel call is a real API call against someone's account. The brakes:
`DESIGN_MAX_CALLS` (plan size, default 10), `DESIGN_MAX_USD`, `DESIGN_MAX_TURNS`,
`DESIGN_TIMEOUT`, `DESIGN_MAX_SHOTS` (evidence per call). `design panel --dry-run`
prints the plan and calls nothing.

Rule of thumb: run `sense` freely, `panel` when the pixels changed. Three lenses
over a dozen screenshots is one small review; three lenses per commit is a bill.

## What this cannot see

State it in the report every time. The list is not a disclaimer, it is scope:

- **Static captures only.** Anything behind a click was not exercised.
- **Lab performance from one cold load.** INP is a field metric; it is not here.
- **Automated accessibility reaches roughly a third of WCAG.** A clean run is not
  a conformance claim, and never gets reported as one.
- **A surface that failed to load is not in the evidence.** It does not become
  "fine"; the report names it as unseen.
- **The distributional tells are priors, not verdicts.** A violet brand is
  allowed to be violet. That is what the contract in the profile is for.

## The two seams

Everything project-shaped enters through **the profile** (`design.config.json`).
Everything browser-shaped enters through **the driver** (`lib/driver.sh`). There
is no third seam, and `design selftest` fails the build if one appears: it greps
the tree for paths and project words, then runs the whole deterministic pipeline
from a scratch directory against fixtures, with no project present at all.

That is also how the detectors are proven. `fixtures/slop.html` has every defect
planted on purpose and `fixtures/clean.html` is the same page built properly; a
rule that stays silent on the first fails, and so does a rule that fires on the
second. Add a rule, plant its violation, watch it fail before you trust it.

## Provenance

The shape of this thing is not invented here. Orchestrator-plus-specialised-
workers and the evaluator/optimizer loop are the two multi-agent patterns that
survive contact with production; the bias controls and the "rubric, not a 1–10
score" rule come from the LLM/VLM-as-judge literature; the critique structure
(location grounding, severity, expected/actual/fix) follows the UI critique
datasets, which found that ungrounded critiques are the ones designers reject.
The measurable half is deliberately boring and standard: WCAG 2.2 thresholds,
axe-core where the driver offers it, Core Web Vitals for the lab numbers, SARIF
for the output, DTCG design tokens as the shape of a token contract.
