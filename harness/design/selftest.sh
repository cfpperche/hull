#!/usr/bin/env bash
# Does this harness work, and is it still portable?
#
# Two questions, and the repo this was written in has a rule behind the first
# one: when you add a guard, plant a violation and watch it fail before trusting
# it — more than one guard in that history passed while testing nothing. So the
# detectors are not unit-tested against mock data. They are pointed at a real
# browser rendering two real pages: one with every defect planted on purpose,
# one built properly. A rule that stays silent on the first fails this script,
# and so does a rule that fires on the second.
#
# The second question is the one that decays. This tree is meant to be copied
# into any project; the moment a path, a host or a product name leaks into it,
# it stops being copyable and nobody notices until the next repo. So the whole
# deterministic pipeline is run from a scratch directory with a profile written
# on the spot, against fixtures — no project, no stack, no credentials. If that
# fails, the coupling is real, whatever the grep says.
set -uo pipefail

DQ_HOME="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PASS=0 FAIL=0
ok()   { printf '  \033[32mok\033[0m   %s\n' "$*"; PASS=$((PASS + 1)); }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$*"; FAIL=$((FAIL + 1)); }
head_() { printf '\n\033[1m%s\033[0m\n' "$*"; }

# ── 1. portability, by grep ─────────────────────────────────────────────────
head_ "1. nothing outside this tree"

leak="$(grep -rIn --exclude-dir=.git -e '/home/' -e '/Users/' "$DQ_HOME" 2>/dev/null \
        | grep -v 'selftest.sh:' || true)"
[[ -z "$leak" ]] && ok "no absolute home paths" || { bad "absolute paths leaked in:"; echo "$leak" | sed 's/^/       /'; }

up="$(grep -rIn --exclude-dir=.git -e '\.\./\.\./' "$DQ_HOME" 2>/dev/null | grep -v 'selftest.sh:' || true)"
[[ -z "$up" ]] && ok "nothing reaches above the harness root" || { bad "reaches out of the tree:"; echo "$up" | sed 's/^/       /'; }

# Project names are the leak a generic grep cannot spot, because naming them
# here would itself be the leak. So the project declares its own words in its
# profile and this check reads them from there.
deny=""
if prof="$(cd "$DQ_HOME/.." && "$DQ_HOME/bin/design" doctor 2>/dev/null | awk '/^profile /{print $2}')" && [[ -n "$prof" ]]; then
  deny="$(jq -r '(.selftest.denyTokens // [])[]' "$prof" 2>/dev/null || true)"
fi
if [[ -n "$deny" ]]; then
  hit=0
  while read -r tok; do
    [[ -z "$tok" ]] && continue
    if grep -rIliq --exclude-dir=.git -- "$tok" "$DQ_HOME" 2>/dev/null; then
      bad "the project word \"$tok\" appears inside the harness:"
      grep -rIli --exclude-dir=.git -- "$tok" "$DQ_HOME" | sed 's/^/       /'
      hit=1
    fi
  done <<<"$deny"
  [[ $hit == 0 ]] && ok "no project-specific words in the tree ($(wc -l <<<"$deny") checked)"
else
  echo "  --   no denyTokens declared by a profile; skipped"
fi

for f in bin/design lib/common.sh lib/profile.sh lib/driver.sh lib/observe.sh lib/rules.sh lib/panel.sh lib/report.sh; do
  bash -n "$DQ_HOME/$f" 2>/dev/null && ok "syntax: $f" || bad "syntax error in $f"
done

# ── 2. the detectors, against planted defects ───────────────────────────────
head_ "2. planted defects, in a real browser"

command -v agent-browser >/dev/null || { echo "  --   agent-browser missing; the browser half of this test cannot run"; echo; echo "$PASS passed, $FAIL failed"; exit $((FAIL > 0)); }
command -v jq >/dev/null || { bad "jq is required"; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"; [[ -n "${SRV:-}" ]] && kill "$SRV" 2>/dev/null' EXIT

BASE=""
if command -v python3 >/dev/null; then
  PORT=$(( 8000 + (RANDOM % 900) ))
  ( cd "$DQ_HOME/fixtures" && exec python3 -m http.server "$PORT" --bind 127.0.0.1 ) >/dev/null 2>&1 &
  SRV=$!
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    curl -sf "http://127.0.0.1:$PORT/clean.html" -o /dev/null && { BASE="http://127.0.0.1:$PORT"; break; }
    sleep 0.3
  done
fi
[[ -z "$BASE" ]] && BASE="file://$DQ_HOME/fixtures"
echo "  fixtures at $BASE"

cat > "$TMP/design.config.json" <<JSON
{
  "project": "fixture",
  "sector": "selftest",
  "out": "runs",
  "viewports": [{ "name": "desktop", "width": 1440, "height": 900 }],
  "surfaces": [
    { "name": "planted", "url": "$BASE/slop.html" },
    { "name": "control", "url": "$BASE/clean.html" }
  ],
  "brand": { "accent": "#0f6d4d", "type": "Georgia" },
  "benchmarks": { "copy": [], "refuse": [] }
}
JSON

( cd "$TMP" && "$DQ_HOME/bin/design" sense >/dev/null 2>"$TMP/sense.log" ) \
  && ok "the whole deterministic pipeline ran in a scratch directory with no project" \
  || { bad "sense failed in a scratch directory — see below"; sed 's/^/       /' "$TMP/sense.log"; }

RUN="$(ls -1d "$TMP"/runs/*/ 2>/dev/null | tail -1)"
if [[ -z "$RUN" ]]; then
  bad "no run directory was produced"
  echo; echo "$PASS passed, $FAIL failed"; exit 1
fi
RUN="${RUN%/}"

fired() { # <surface> <rule>
  jq -e --arg s "$1" --arg r "$2" 'any(.[]; .surface == $s and .rule == $r)' "$RUN/findings.json" >/dev/null 2>&1
}

# Before believing a single "quiet on the control page", prove the control page
# was actually looked at. Silence from a sensor that never ran looks exactly
# like silence from a page with nothing wrong, and that mistake would make every
# assertion below meaningless.
for surface in planted control; do
  f="$RUN/facts/$surface@desktop.json"
  if [[ -s "$f" ]] && [[ "$(jq -r '.sensors.census.facts.elements // 0' "$f")" -gt 5 ]]; then
    ok "$surface was measured ($(jq -r '.sensors.census.facts.elements' "$f") visible elements)"
  else
    bad "$surface produced no measurements — every assertion about it below is meaningless"
  fi
done

MUST_FIRE=(
  contrast.text contrast.nontext
  a11y.control-name a11y.placeholder-as-label a11y.img-alt a11y.html-lang
  a11y.zoom-blocked a11y.duplicate-id a11y.tabindex-positive a11y.focus-invisible
  a11y.landmark-main a11y.heading-order
  target.size
  layout.horizontal-scroll layout.text-clipped layout.truncated-untitled
  budget.type-scale budget.font-families
  hierarchy.heading-collapse identity.distributional
)
for r in "${MUST_FIRE[@]}"; do
  fired planted "$r" && ok "fires on the planted page: $r" || bad "SILENT on the planted page: $r"
done

MUST_BE_QUIET=(
  contrast.text a11y.control-name a11y.img-alt a11y.html-lang a11y.focus-invisible
  a11y.zoom-blocked a11y.duplicate-id a11y.tabindex-positive
  layout.horizontal-scroll layout.text-clipped target.size
  budget.type-scale budget.font-families budget.palette identity.distributional
)
for r in "${MUST_BE_QUIET[@]}"; do
  fired control "$r" && bad "false positive on the control page: $r" || ok "quiet on the control page: $r"
done

head_ "3. the distributional tells"
TELLS="$(jq -r '.sensors.slop.facts.tells // [] | join(" ")' "$RUN/facts/planted@desktop.json" 2>/dev/null || echo "")"
for t in violet-accent cool-gradient glassmorphism left-border-strip feature-triplet badge-above-headline emoji-icons; do
  [[ " $TELLS " == *" $t "* ]] && ok "tell detected: $t" || bad "tell missed: $t"
done
CLEAN_TELLS="$(jq -r '.sensors.slop.facts.tells // [] | length' "$RUN/facts/control@desktop.json" 2>/dev/null || echo 99)"
[[ "$CLEAN_TELLS" -le 1 ]] && ok "control page carries ${CLEAN_TELLS} tells" || bad "control page carries $CLEAN_TELLS tells — the slop sensor is too eager"

head_ "4. artefacts"
[[ -s "$RUN/report.md" ]] && ok "report.md written" || bad "no report.md"
[[ -s "$RUN/findings.sarif" ]] && ok "findings.sarif written" || bad "no findings.sarif"
jq -e '.version == "2.1.0" and (.runs[0].results | length) > 0' "$RUN/findings.sarif" >/dev/null 2>&1 \
  && ok "SARIF 2.1.0 with results" || bad "SARIF is malformed or empty"
[[ -s "$RUN/trace.jsonl" ]] && ok "trace.jsonl written" || bad "no trace"
n_shots=$(ls "$RUN"/shots/*.png 2>/dev/null | wc -l)
[[ "$n_shots" -ge 2 ]] && ok "$n_shots screenshots captured" || bad "expected 2 screenshots, got $n_shots"

# A panel plan must be producible without spending anything.
( cd "$TMP" && "$DQ_HOME/bin/design" panel --dry-run >/dev/null 2>&1 ) \
  && [[ -s "$RUN/panel/plan.json" ]] \
  && ok "panel --dry-run plans without calling a model" \
  || bad "panel --dry-run did not produce a plan"

printf '\n%s passed, %s failed\n' "$PASS" "$FAIL"
[[ "$FAIL" -gt 0 ]] && exit 1
exit 0
