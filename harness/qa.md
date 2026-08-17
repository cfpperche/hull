# Agentic QA harness

A live Hull an agent can poke while working on a task. Not a suite. Nothing here
runs in CI.

Deterministic browser coverage is `e2e/` and it starts from an empty browser
every time. This one starts from a browser that has **been somewhere** — that is
the gap it exists to close. The redirect loop in PR #9 passed review, 34 tests,
smoke, the visual harness and green CI because every one of those begins clean.

| Layer | Runs | Answers |
|---|---|---|
| `scripts/test.sh` | CI | does the adapter behave? |
| `e2e/` | CI | does the flow work in a browser, from clean? |
| `scripts/smoke.sh` | after `up.sh` | is this install live and trusted? |
| `harness/scripts/capture-ui.sh` | on demand | how does it look? |
| **`harness/scripts/qa.sh`** | **on demand, mid-task** | **what breaks when I poke it, carrying state?** |

Do not merge these. A finding here that deserves to be permanent becomes an `e2e/`
spec or a pytest case; the harness is where you find it, not where it lives.

## Use it

```bash
./harness/scripts/qa.sh doctor                              # ready?
./harness/scripts/qa.sh start --persona member --taint legacy-cookie
eval "$(./harness/scripts/qa.sh env)"                       # in every shell after
agent-browser snapshot -i                                   # drive it yourself
./harness/scripts/qa.sh look after-signin                   # evidence
./harness/scripts/qa.sh note "..."                          # findings, as you go
./harness/scripts/qa.sh stop
```

`qa.sh` sets the table. It does not wrap `click`/`fill` — that is `agent-browser`,
and `agent-browser skills get core --full` already teaches it. What the script
owns is the part that is Hull-specific and easy to get wrong: an isolated browser
per agent, a persona that is *proven* signed in, a starting state you chose, and
an evidence directory.

Headless is the default. `--headed` opens a real window; `qa.sh watch` streams the
same live session to `http://localhost:4848`, where a human can watch and click.
Both are opt-in, and neither is needed for a normal run.

## Personas

| | Who |
|---|---|
| `anon` | no session |
| `member` | `ada@<host>` — the lab member |
| `admin` | `admin@<host>` — platform admin, on `admin.` |

Sign-in is asserted out of band. `agent-browser` exits 0 on a failed step, so a
missed sign-in would otherwise leave you exploring the login page and reporting
it as the product.

## Taints

The starting state. This is the part `e2e/` cannot have, because a deterministic
suite that starts dirty is not deterministic.

| | What the browser drags in |
|---|---|
| `clean` | nothing |
| `legacy-cookie` | an apex-scoped `hull_session` beside the host-scoped one — PR #9's exact shape |
| `stale` | a host-scoped cookie holding a token the server never issued |
| `junk` | a host-scoped cookie holding a legal-but-hostile value, not a token |
| `carry` | whatever the last run left, reopened where it left off |

`carry` replaces the persona: the saved state already says who you are.

A taint that cannot be planted **fails the run**. Chrome silently refuses illegal
cookie values, and a run that reports a state the browser was never in is worse
than no run.

## Three agents, three browsers

Claude, Codex and Grok share this repo. `agent-browser`'s default session is one
browser for the whole machine, so without isolation one agent navigating away
looks like a Hull bug to another. Sessions are named `hull-qa-<agent>-<stamp>`
and detected from the environment; override with `HULL_QA_AGENT`.

Findings are files, not conversation. `harness/qa/runs/<run>/` holds `report.md`,
`meta` and `shots/`, all gitignored. That is what lets a second agent replay a
first agent's finding without having been there.

## What counts as a finding

Repro steps someone else can paste, or it is a rumour.

- the **state** it started from — persona and taint, by name
- where — URL and the `data-testid`, not "the button"
- the commands, in order
- evidence — `qa.sh look` writes annotated PNGs, and **read them**; a path is not a look
- what you expected, what happened

Write it with `qa.sh note` when you find it, not at the end. A run that dies takes
unwritten findings with it.

## Do not

- Do not run this in CI. It is non-deterministic on purpose.
- Do not grow `smoke.sh` or `e2e/` into it, or it into them.
- Do not report a run whose `start` failed. Nothing was tested.
