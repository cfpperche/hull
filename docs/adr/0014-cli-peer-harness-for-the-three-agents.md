# 0014. A CLI peer harness, so the three agents can ask each other

**Status:** Accepted  
**Date:** 2026-08-17

## Context

Three coding agents work in this repo — Claude, Codex and Grok — and `AGENTS.md`
has said from the start that the operating model is **not defined**: nobody is
appointed planner, implementer or reviewer. That stays true here. What was missing
is smaller and more concrete: they had no way to talk. Each one reads `AGENTS.md`,
works, leaves files, and the next one reads the tree. Every exchange between them
is a diff and a `CHANGELOG.md` line, after the fact.

That costs us the one thing three vendors are actually worth. They fail
differently: PR #9's duplicate-cookie redirect loop survived an adversarial review,
34 tests, `smoke.sh`, the visual harness and green CI, and the operator hit it on
the first sign-in. A second model reading the same diff is not a second test, but
it is a second set of blind spots, and the cheapest moment to get one is while the
first agent still has the question — not three commits later.

All three runtimes are installed on this workstation and all three run headless
with structured output and resumable sessions (`claude -p`, `codex exec`,
`grok --prompt-file`). They agree on nothing else. Final message, schema flag,
session id, cost accounting and read-only enforcement are different in each, and
two of the three ship a flag that looks like a guard and is not.

## Decision

Add `harness/scripts/peer.sh` — one agent asks another over its CLI, and every
exchange lands on disk. Protocol in `harness/peer.md`.

**Shell, not MCP, and not a daemon.** Same reasoning as ADR-0013: the three agents
configure MCP differently, and the one that has not configured it would find the
harness silently absent. A script in the tree is the one interface all three
certainly have. It needs no server to be up, no port, and no second thing to
babysit. It also composes — `peer.sh review codex --base main` is a line in a
script, and the answer is a file.

**Five verbs, one envelope.** `ask` (delegate), `review` (a diff, against a fixed
schema), `audit` (one claim: confirmed / refuted / unproven), `duel` (adversarial),
`reply` (same thread, resumed). Every one sends the same preamble and the same
rules, so a difference between two answers is a difference in judgment rather than
a difference in what we asked.

**Ask the peer you are not.** `peer.sh ask claude` from Claude is refused. Same
model, same blind spots, same prompt, billed twice. `duel` asks the two peers you
are not, and the caller's own review is the caller's to write. Identity comes from
`scripts/lib/agent.sh`, off environment markers confirmed by asking each runtime to
print its own environment. The guess `qa.sh` carries inline looks for
`CODEX_HOME`/`CODEX_SANDBOX` and `GROK_CLI`/`GROK_SESSION`; none of those four were
set in the environments measured here, where the real markers are `CODEX_THREAD_ID`
and `GROK_AGENT` — so `qa.sh` detects only Claude and files two agents' browser
sessions under one key, which is the collision ADR-0013 added the name to prevent.

**Read-only by default, and the flag is not trusted.** Reviewers get read-only:
`--sandbox read-only` for Codex and Grok, `--permission-mode dontAsk` for Claude —
each measured against a peer told to create a file. Grok's `--permission-mode
dontAsk` and `--permission-mode plan` both created it; its `--sandbox read-only`
refused three ways under bubblewrap. So every exchange records the exact argv, and
the harness compares `git status --porcelain -uall` before and after every call,
failing with exit 3 and naming the paths if the tree moved. Three guards in this
repo's history passed while testing nothing; this one is checked against the tree,
not against a flag.

**A delegated write lands in a worktree, never in your tree.** `ask --write` cuts a
throwaway worktree from `HEAD`, runs the peer there, stages and prints the diff, and
applies nothing. The peer does not need git — the harness diffs from outside the
peer's sandbox — so git write access can stay denied. The worktree is gitignored
from the main tree, which is what makes the same tripwire meaningful here: anything
it sees during a write-mode call is a leak out of the worktree.

**Round 1 of a duel is blind.** Each peer reviews the same captured bytes without
seeing the other's answer; round 2 hands each peer the *others'* claims, as data,
and asks for confirm / refute / unproven with evidence. Contested claims sort to
the top of the report. Showing the second agent the first one's conclusion first is
how a multi-agent review collapses into consensus, and consensus is worth less than
one honest review because it arrives wearing a badge.

**A peer's answer is untrusted input.** It is quoted, never executed, and when it
becomes another peer's input it goes inside a fenced *untrusted data* block that
says so. `peer.sh` never lets peer text choose a command.

**It is not a gate and never runs in CI.** A peer is non-deterministic, billed per
call, and answers with an opinion. An answer that deserves to be permanent becomes
a pytest case, an `e2e/` spec, an ADR or a `CHANGELOG.md` line — with the reasoning,
not with "Codex said so".

## Consequences

Delegation now has a price tag in the tree. A bare "reply PONG" measured $0.064
for Claude on Sonnet and $0.0056 for Grok — the answer is twelve tokens; the bill
is the context each peer ingests before it can say anything. Codex reports tokens,
not dollars, and a 53KB review came to 138k of them. A review costs an order of
magnitude more than a question: Claude reviewing a 143-line commit ran sixteen
turns and hit the $1.00 cap, returning `error_max_budget_usd` and no answer, while
the duel it was in carried on without it. The cap worked; the number is the point. `peer.sh ls` totals what was reported, and `PEER_TIMEOUT`,
`PEER_MAX_USD` and `PEER_MAX_TURNS` are the only brakes the three CLIs give us —
Codex offers none, so the timeout is the floor under all three.

Grok is slow and answers more than once. On a 143-line commit it emitted
`{"findings":[]}` in seconds, kept reading for eleven minutes, and emitted the real
findings after it — all concatenated into one `.text` string. A plain `json.loads`
dies on that with "Extra data" and throws away the answer that took the eleven
minutes, so schema'd answers are scanned for every top-level value and the peer's
last word wins. Budget minutes for a duel, not keystrokes.

The tripwire has a false positive we chose to keep. It cannot tell a peer's write
from a person's, and this workstation runs other agents in this same tree — the
first real duel was marked tainted because a neighbour saved `CHANGELOG.md`
mid-review. `PEER_TRIPWIRE=warn` keeps and flags such an exchange instead of
failing it, and `duel` always keeps a tainted answer and prints the taint beside
the claims. A guard that fails for someone else's autosave teaches people to
ignore guards.

An interrupted duel had to be taught to let go. Killed by an outer timeout, the
first version left a Grok review running eleven more minutes, billed and
invisible: `timeout` kills only the child it started, background subshells were in
no trap, and a polite `TERM` to the wrapper left the sandboxed binary alive. The
handler now walks the process tree, escalates to `KILL`, and — because a bash
signal handler otherwise returns to the next line — exits instead of carrying on
into round 2.

Two harnesses now guess which agent is driving. `scripts/lib/agent.sh` is the
correct one; `harness/scripts/qa.sh` keeps its own broken copy because it was mid
change when this landed. Whoever next touches `qa.sh` should delete that block and
source the lib, or the two will disagree about who is running and file state under
different keys.

The harness reviewed itself before it was pushed, and that paid for itself twice.
Codex, given the commit, found that a `duel` whose reviewers all failed wrote a
"no findings" report and returned 0 — *nobody found anything* and *nobody
reviewed* printing the same way, which is the exact shape of a guard that passes
while testing nothing. It also found that a schema'd answer was only parsed, never
checked, so any JSON that happened to be last in the text was accepted as the
review. Both are fixed here: a duel with no usable review exits 2 and says so, and
an answer is validated against its schema — with `jsonschema` when importable, by
required keys when not, keeping the last *valid* value rather than the last one.
A harness for second opinions that had not asked for one would have been a poor
advertisement.

Running every verb against every peer found a third: `audit codex` had never
worked. OpenAI's structured output requires every key of a schema to appear in
`required` — an optional field is `"type": ["string", "null"]` and still required —
and Codex fails the whole call with a 400 where Claude and Grok accept the same
schema. The audit schema had one optional key and had only ever been tried against
Grok. `doctor` now checks all three schemas for it, free, and the check was proved
by planting the same violation and watching it reject. One vendor's rule silently
becoming the contract for all three is the recurring cost of this design, and the
answer is the same each time: check it locally, before a billed call finds it.

This is a phone line, not an org chart. The temptation it creates is to grow it
into the pipeline `AGENTS.md` refuses — every-change-reviewed-by-Codex, planning
delegated to Grok. Machinery like that is a decision about how we work and needs
its own ADR, argued on its merits, not a default that arrived because a script made
it easy.
