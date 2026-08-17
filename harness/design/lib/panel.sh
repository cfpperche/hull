# The panel — several agents, on purpose, with different jobs.
#
# Why more than one model at all. A single judge asked "review this UI" answers
# with one model's taste, at one temperature, and it will answer confidently
# whether or not it looked. The literature on LLM/VLM judging is consistent
# about the failure modes — position bias, verbosity bias, self-preference, and
# drift over time — and equally consistent about what reduces them: an explicit
# rubric instead of "rate this", independent scoring before any comparison,
# randomised order, and a panel drawn from different model families.
#
# So the shape here is not "many agents because many is better". It is:
#
#   sensors  →  critics (specialised lenses, run independently)
#            →  refuters (adversarial, shuffled, default-to-refute)
#            →  arbiter (merge, rank, name the disagreements)
#
# Every stage narrows. The sensors make the critics cheap and grounded — a judge
# that is handed the measured contrast ratio stops guessing about contrast and
# spends its attention on what only a judge can do. The refuters exist because a
# critic that finds nothing feels like a failure to a model, so critics reach;
# the cheapest correction is an adversary whose default answer is "no".
#
# What this file does NOT do: decide who reviews whom for a given task, or run
# in CI. A peer is non-deterministic, costs money per call, and its answer is
# evidence — never a gate. The deterministic half (`sense`) is the gate-able one.

DESIGN_TIMEOUT="${DESIGN_TIMEOUT:-900}"
DESIGN_MAX_USD="${DESIGN_MAX_USD:-1.00}"
DESIGN_MAX_TURNS="${DESIGN_MAX_TURNS:-40}"
DESIGN_MAX_CALLS="${DESIGN_MAX_CALLS:-10}"
DESIGN_MAX_SHOTS="${DESIGN_MAX_SHOTS:-12}"

# Vision is a hard capability, not a preference. Measured 2026-08-17 on the CLIs
# present here: `claude` reads image files through its file tool; `codex exec`
# attaches them with -i; `grok` 1.0.4 has no image flag at all. A blind runtime
# handed a list of PNG paths does not say "I cannot see these" — it writes a
# confident critique of a page it never looked at, which is the worst output
# this harness could produce. So a visual lens on a blind runtime is refused,
# and blind runtimes are given the work that needs no pixels: refutation against
# measured numbers, and the DOM-side usability lens.
dq_roster() { # name|vision|model
  local r; r="$(dq_pj '.panel.runtimes // empty')"
  if [[ -z "$r" || "$r" == null ]]; then
    r='[{"name":"claude","vision":true},{"name":"codex","vision":true},{"name":"grok","vision":false}]'
  fi
  echo "$r" | jq -r '.[] | "\(.name)|\(.vision // false)|\(.model // "")"'
}

dq_runtime_available() { command -v "$1" >/dev/null; }

DQ_VISUAL_LENSES="craft identity"

dq_lens_needs_vision() { [[ " $DQ_VISUAL_LENSES " == *" $1 "* ]]; }

# Which runtime runs which lens. Explicit in the profile, or round-robin over
# whatever is installed — with visual lenses only ever landing on a runtime that
# can see.
dq_assign() { # <lens list> -> "lens|runtime|model" per line
  local lenses="$1" explicit
  explicit="$(dq_pj '.panel.assign // empty')"
  local -a vision=() blind=()
  local line name vis model
  while IFS='|' read -r name vis model; do
    dq_runtime_available "$name" || continue
    if [[ "$vis" == true ]]; then vision+=("$name|$model"); else blind+=("$name|$model"); fi
  done < <(dq_roster)

  # Two counters, not one: visual lenses round-robin over the runtimes that can
  # see, and non-visual ones start at the blind end of the pool. Otherwise a
  # blind runtime sits idle while a seeing one spends its attention on a lens
  # that never needed pixels.
  local lens i=0 j=0
  for lens in $lenses; do
    if [[ -n "$explicit" && "$explicit" != null ]]; then
      local want; want="$(echo "$explicit" | jq -r --arg l "$lens" '.[$l] // empty | if type=="array" then .[] else . end')"
      if [[ -n "$want" ]]; then
        local w
        for w in $want; do
          dq_runtime_available "$w" || { warn "lens $lens is assigned to $w, which is not installed — skipped"; continue; }
          if dq_lens_needs_vision "$lens" && ! dq_roster | grep -q "^$w|true|"; then
            warn "lens $lens needs pixels and $w cannot see them — skipped (see lib/panel.sh)"
            continue
          fi
          echo "$lens|$w|"
        done
        continue
      fi
    fi
    if dq_lens_needs_vision "$lens"; then
      [[ ${#vision[@]} -eq 0 ]] && { warn "no runtime here can see a screenshot; lens \"$lens\" cannot run"; continue; }
      local pick="${vision[$((i % ${#vision[@]}))]}"
      echo "$lens|${pick%%|*}|${pick##*|}"
      i=$((i + 1))
    else
      local pool=("${blind[@]+"${blind[@]}"}" "${vision[@]+"${vision[@]}"}")
      [[ ${#pool[@]} -eq 0 ]] && { warn "no runtime installed; lens \"$lens\" cannot run"; continue; }
      local pick="${pool[$((j % ${#pool[@]}))]}"
      echo "$lens|${pick%%|*}|${pick##*|}"
      j=$((j + 1))
    fi
  done
}

# ── the evidence pack ───────────────────────────────────────────────────────
# Same pack for every critic, so a difference between two critiques is a
# difference in judgment and not a difference in what they were shown.
dq_digest() { # <run> -> compact facts every critic gets inline
  local run="$1"
  jq -s '[ .[] | {
      surface, viewport, url, landed, persona, shot,
      type: (.sensors.census.facts // {} | {typeScale, typeScaleCount, fontFamilies, fontWeights, headingLadder, headingCollapse}),
      shape: (.sensors.census.facts // {} | {radii, shadows: (.shadows // [] | length), palette: (.palette // [] | .[0:12]), paletteCount, spacingOffGrid}),
      layout: (.sensors.overflow.facts // {}),
      a11y: (.sensors.semantics.facts // {}),
      runtime: (.sensors.runtime.facts // {}),
      tells: (.sensors.slop.tells // [] | map({tell, count, why})),
      measured: [ .sensors | to_entries[] | (.value.findings // [])[] | {rule, severity, selector, message} ] | .[0:25]
    } ]' "$run"/facts/*.json
}

dq_shot_list() { # <run> -> absolute paths, capped
  ls "$1"/shots/*.png 2>/dev/null | head -n "$DESIGN_MAX_SHOTS"
}

dq_contract() { # the taste half of the profile, verbatim
  dq_pj '{project, sector: (.sector // "unstated"), brand: (.brand // {}),
          benchmarks: (.benchmarks // {}), tokens: (.tokens // null),
          budgets: (.budgets // {}), notes: (.notes // [])}'
}

dq_envelope() { # <dir> <role> <runtime> <lens>
  local dir="$1" role="$2" runtime="$3" lens="$4"
  {
    echo "# Design panel — $role${lens:+ · lens: $lens}"
    echo
    echo "**Runtime:** \`$runtime\` · **Harness:** design $DQ_VERSION · **Run:** \`$(basename "$DQ_RUN")\` · **Project root:** \`$DQ_PROJECT_ROOT\`"
    echo
    echo "**Mode: read-only.** Do not create, edit, move or delete any file, and do not"
    echo "run anything that writes. The caller photographs the tree before and after this"
    echo "call and reports a mismatch, so a write is not a shortcut — it is a finding"
    echo "against you. Read whatever you need."
    echo
    echo "**Answer with JSON only**, matching the schema you were given. No prose outside"
    echo "it, no code fences. Anything you cannot support with the evidence below either"
    echo "gets a low confidence or does not get written."
    echo
  } > "$dir/request.md"
}

dq_attach_evidence() { # <dir> <run> <vision>
  local dir="$1" run="$2" vision="$3"
  {
    echo "## The contract"
    echo
    echo 'This is what the project says it is. It is the standard you judge against —'
    echo 'not your own defaults, and not the average of the web.'
    echo
    echo '```json'
    dq_contract | jq .
    echo '```'
    echo
    echo "## Evidence — screenshots"
    echo
    if [[ "$vision" == true ]]; then
      echo "**Open every one of these.** A path is not a look, and a critique written"
      echo "from the file names is the failure this harness exists to prevent."
    else
      echo "This runtime cannot open images. The screenshots are listed for reference"
      echo "only — **do not describe them**. Judge from the measured facts and the DOM."
    fi
    echo
    local p
    while read -r p; do [[ -n "$p" ]] && echo "- \`$p\`"; done < <(dq_shot_list "$run")
    echo
    if [[ "$(cat "$run/.capture-mode" 2>/dev/null || echo capture)" == print-fallback ]]; then
      echo "**These are print renders, not screenshots.** This host would not produce a"
      echo "frame, so the pages were printed and rasterised. The DOM is the same; the"
      echo "*width* is paper width, not the viewport width in the facts below. Judge"
      echo "colour, type, hierarchy and craft from them. Do **not** file a finding about"
      echo "wrapping, the fold, or anything that depends on the viewport being that wide."
      echo
    fi
    if [[ -d "$run/dom" ]] && ls "$run"/dom/*.txt >/dev/null 2>&1; then
      echo "## Evidence — accessibility tree per surface"
      echo
      for p in "$run"/dom/*.txt; do echo "- \`$p\`"; done
      echo
    fi
    echo "## Evidence — what the browser measured"
    echo
    echo "Numbers here were read out of the live page, not estimated. Where one"
    echo "contradicts your impression of a screenshot, the number is right and your"
    echo "impression is the finding worth writing."
    echo
    echo '```json'
    dq_digest "$run"
    echo '```'
    echo
  } >> "$dir/request.md"
}

# ── running a runtime ───────────────────────────────────────────────────────
# Flag shapes below are per-vendor and were measured, not guessed. Keep the
# provenance comment when editing: three CLIs that agree on nothing is exactly
# where a silent behaviour change hides.
#
#   claude   -p            .result        --json-schema JSON     images: file tool
#   codex    exec          -o FILE        --output-schema FILE   images: -i FILE
#   grok     --prompt-file .text          --json-schema JSON     images: none
dq_call() { # <runtime> <dir> <schema-file> <model> <vision> <run>
  local rt="$1" dir="$2" schema="$3" model="$4" vision="$5" run="$6"
  local -a cmd
  case "$rt" in
    claude)
      cmd=(claude -p --output-format json --permission-mode dontAsk
           --max-budget-usd "$DESIGN_MAX_USD" --add-dir "$run")
      [[ -n "$model" ]] && cmd+=(--model "$model")
      cmd+=(--json-schema "$(cat "$schema")")
      printf '%s\n' "${cmd[@]}" > "$dir/cmd"
      ( cd "$DQ_PROJECT_ROOT" && exec timeout "$DESIGN_TIMEOUT" "${cmd[@]}" ) \
        <"$dir/request.md" >"$dir/raw.json" 2>"$dir/stderr.log"
      ;;
    codex)
      cmd=(codex exec -C "$DQ_PROJECT_ROOT" --sandbox read-only --json --skip-git-repo-check
           -o "$dir/answer.txt" --output-schema "$schema")
      [[ -n "$model" ]] && cmd+=(--model "$model")
      if [[ "$vision" == true ]]; then
        local p
        while read -r p; do [[ -n "$p" ]] && cmd+=(-i "$p"); done < <(dq_shot_list "$run")
      fi
      cmd+=(-)
      printf '%s\n' "${cmd[@]}" > "$dir/cmd"
      ( cd "$DQ_PROJECT_ROOT" && exec timeout "$DESIGN_TIMEOUT" "${cmd[@]}" ) \
        <"$dir/request.md" >"$dir/raw.jsonl" 2>"$dir/stderr.log"
      ;;
    grok)
      cmd=(grok --output-format json --cwd "$DQ_PROJECT_ROOT" --sandbox read-only
           --max-turns "$DESIGN_MAX_TURNS" --prompt-file "$dir/request.md"
           --json-schema "$(cat "$schema")")
      [[ -n "$model" ]] && cmd+=(-m "$model")
      printf '%s\n' "${cmd[@]}" > "$dir/cmd"
      timeout "$DESIGN_TIMEOUT" "${cmd[@]}" </dev/null >"$dir/raw.json" 2>"$dir/stderr.log"
      ;;
    *) warn "unknown runtime $rt"; return 1 ;;
  esac
}

# Why a call failed, in one line, from wherever that vendor put it. Without this
# a budget cut-off and a crashed CLI look identical — an empty stderr and a
# non-zero exit — and the operator retries the wrong thing.
dq_why_failed() { # <runtime> <dir>
  local rt="$1" dir="$2" why=""
  case "$rt" in
    claude|grok)
      [[ -s "$dir/raw.json" ]] && why="$(jq -r '
        if (.is_error // false) then
          "the runtime stopped early (stop_reason: \(.stop_reason // "?"), spent $\(.total_cost_usd // 0 | tostring)). If that is at or over DESIGN_MAX_USD, raise it."
        else empty end' "$dir/raw.json" 2>/dev/null)"
      ;;
    codex) [[ -s "$dir/raw.jsonl" ]] && why="$(grep -o '"error":"[^"]*"' "$dir/raw.jsonl" | tail -1)" ;;
  esac
  [[ -z "$why" && -s "$dir/stderr.log" ]] && why="$(tail -2 "$dir/stderr.log")"
  [[ -n "$why" ]] && warn "  reason: $why"
}

dq_extract() { # <runtime> <dir> -> the JSON the model returned, or nothing
  local rt="$1" dir="$2" text=""
  case "$rt" in
    claude) [[ -s "$dir/raw.json" ]] && text="$(jq -r '.result // empty' "$dir/raw.json" 2>/dev/null || true)" ;;
    codex)  [[ -s "$dir/answer.txt" ]] && text="$(cat "$dir/answer.txt")" ;;
    grok)   [[ -s "$dir/raw.json" ]] && text="$(jq -r '.text // .result // empty' "$dir/raw.json" 2>/dev/null || true)" ;;
  esac
  [[ -z "$text" ]] && return 1
  # A schema-constrained runtime still sometimes fences its answer.
  text="$(sed -e 's/^```json$//' -e 's/^```$//' <<<"$text")"
  jq -e . <<<"$text" >/dev/null 2>&1 || return 1
  printf '%s' "$text"
}

# The tree tripwire, borrowed from the peer protocol: a read-only call that
# changed the working tree is reported as tainted rather than trusted, because a
# vendor flag that silently does nothing is a real failure mode and this is the
# only check that does not depend on the vendor telling the truth.
dq_tree() { git -C "$DQ_PROJECT_ROOT" status --porcelain=v1 -uall 2>/dev/null | sort || true; }

# ── stages ──────────────────────────────────────────────────────────────────
dq_panel() { # <run> <lens csv> <dry-run 0|1>
  local run="$1" lenses="${2:-craft usability identity}" dry="${3:-0}"
  lenses="${lenses//,/ }"
  mkdir -p "$run/panel"

  local plan; plan="$(dq_assign "$lenses")"
  [[ -z "$plan" ]] && { warn "nothing to run: no installed runtime can serve these lenses"; return 0; }

  local n; n="$(wc -l <<<"$plan")"
  note "panel plan ($n calls, max $DESIGN_MAX_CALLS):"
  printf '  %s\n' $(echo "$plan" | tr '\n' ' ') >&2
  [[ "$n" -gt "$DESIGN_MAX_CALLS" ]] && die "plan is $n calls, over DESIGN_MAX_CALLS=$DESIGN_MAX_CALLS"
  if [[ "$dry" == 1 ]]; then
    echo "$plan" | jq -Rs 'split("\n") | map(select(length>0))' > "$run/panel/plan.json"
    note "dry run: wrote $run/panel/plan.json, called nothing"
    return 0
  fi

  local before; before="$(dq_tree)"
  local lens rt model
  while IFS='|' read -r lens rt model; do
    [[ -z "$lens" ]] && continue
    local vision=false
    dq_roster | grep -q "^$rt|true|" && vision=true
    local dir="$run/panel/$lens-$rt"
    mkdir -p "$dir"

    dq_envelope "$dir" critic "$rt" "$lens"
    cat "$DQ_HOME/prompts/$lens.md" >> "$dir/request.md"
    echo >> "$dir/request.md"
    dq_attach_evidence "$dir" "$run" "$vision"

    note "panel: $lens on $rt$([[ $vision == true ]] && echo ' (sees pixels)' || echo ' (blind — facts only)')"
    local t0; t0=$(date +%s)
    if ! dq_call "$rt" "$dir" "$DQ_HOME/schemas/critique.schema.json" "$model" "$vision" "$run"; then
      warn "$lens/$rt: the call failed — see $dir/stderr.log"
      dq_why_failed "$rt" "$dir"
      dq_span chat "critic.$lens.$rt" error '{"gen_ai.system":"'"$rt"'"}'
      continue
    fi
    if dq_extract "$rt" "$dir" > "$dir/critique.json"; then
      jq -c --arg lens "$lens" --arg rt "$rt" \
        '{lens:$lens, runtime:$rt, verdict, scores, findings}' "$dir/critique.json" > "$dir/normalised.json"
      dq_span chat "critic.$lens.$rt" ok "$(jq -cn --arg r "$rt" --arg l "$lens" --argjson s "$(($(date +%s) - t0))" \
        '{"gen_ai.system":$r, lens:$l, "duration.s":$s}')"
    else
      warn "$lens/$rt: the answer did not parse as JSON — kept at $dir/ for inspection"
      rm -f "$dir/critique.json"
      dq_span chat "critic.$lens.$rt" error '{"gen_ai.system":"'"$rt"'","reason":"unparseable"}'
    fi
  done <<<"$plan"

  local after; after="$(dq_tree)"
  if [[ "$before" != "$after" ]]; then
    warn "TAINTED: the working tree changed during a read-only panel run."
    diff <(echo "$before") <(echo "$after") | sed 's/^/    /' >&2 || true
    dq_span invoke_agent panel tainted '{}'
  fi

  # Critic findings get ids the same way sensor findings do, so the refuters and
  # the arbiter can talk about them without ambiguity.
  local out="$run/findings-panel.json"
  jq -s '[ .[] | .lens as $lens | .runtime as $rt | (.findings // [])[]
           | . + {lens:$lens, runtime:$rt, source:"panel"} ]' \
     "$run"/panel/*/normalised.json 2>/dev/null > "$out" || echo '[]' > "$out"
  local tmp; tmp="$(mktemp)"
  jq -c '.[]' "$out" | while read -r line; do
    local id; id="$(dq_fid "$(jq -r '"\(.lens)|\(.surface)|\(.viewport)|\(.where)|\(.title)"' <<<"$line")")"
    jq -c --arg id "$id" '{id:$id} + .' <<<"$line"
  done | jq -s '.' > "$tmp" && mv "$tmp" "$out"

  jq -s '[.[] | {lens, runtime, verdict, scores}]' "$run"/panel/*/normalised.json 2>/dev/null \
    > "$run/scores.json" || echo '[]' > "$run/scores.json"
  note "panel findings: $(jq length "$out")"
}

# Who refutes, and who arbitrates. Both default to whatever is installed, in
# roster order, and both can be named in the profile — worth doing, because the
# useful arrangement is one family writing the critique and a different one
# trying to kill it. A refuter from the same family as the critic agrees with it
# for the same reasons the critic was wrong.
dq_pool_for() { # <panel key> -> runtime names, one per line
  local key="$1" named pool=() name vis model
  named="$(dq_p ".panel.$key // empty")"
  if [[ -n "$named" && "$named" != null ]]; then
    for name in $(dq_pj ".panel.$key | if type==\"array\" then .[] else . end" | tr -d '"'); do
      dq_runtime_available "$name" && pool+=("$name") || warn "panel.$key names $name, which is not installed"
    done
  else
    while IFS='|' read -r name vis model; do dq_runtime_available "$name" && pool+=("$name"); done < <(dq_roster)
  fi
  printf '%s\n' "${pool[@]+"${pool[@]}"}"
}

dq_refute() { # <run> <n refuters>
  local run="$1" want="${2:-}"
  [[ -z "$want" ]] && want="$(dq_p '.panel.refuters // 1')"
  local pool=()
  mapfile -t pool < <(dq_pool_for refuterRuntimes)
  [[ ${#pool[@]} -eq 0 ]] && { warn "no runtime installed — nothing to refute with"; return 0; }

  local all="$run/findings-panel.json"
  [[ -s "$all" ]] || { warn "no panel findings to refute"; return 0; }
  [[ "$(jq length "$all")" == 0 ]] && { note "no panel findings to refute"; return 0; }

  mkdir -p "$run/refute"
  local i=0 rt
  for ((i = 0; i < want && i < ${#pool[@]}; i++)); do
    rt="${pool[$i]}"
    local vision=false; dq_roster | grep -q "^$rt|true|" && vision=true
    local dir="$run/refute/$rt"; mkdir -p "$dir"

    # Shuffled per refuter: a judge's answer moves with position, so the order
    # is randomised and recorded rather than left as a hidden variable.
    jq -c '.[] | {id, lens: .lens, title, severity, surface, viewport, where, evidence, expected, actual, confidence}' "$all" \
      | dq_shuffle | jq -s '.' > "$dir/shuffled.json"

    dq_envelope "$dir" refuter "$rt" ""
    cat "$DQ_HOME/prompts/refuter.md" >> "$dir/request.md"
    {
      echo
      echo "## The findings to refute"
      echo
      echo '```json'
      cat "$dir/shuffled.json"
      echo '```'
      echo
    } >> "$dir/request.md"
    dq_attach_evidence "$dir" "$run" "$vision"

    note "refute: $rt over $(jq length "$dir/shuffled.json") findings"
    if ! dq_call "$rt" "$dir" "$DQ_HOME/schemas/verdicts.schema.json" "" "$vision" "$run"; then
      warn "refuter $rt failed — see $dir/stderr.log"; dq_why_failed "$rt" "$dir"; continue
    fi
    if dq_extract "$rt" "$dir" > "$dir/verdicts.json"; then
      dq_span chat "refute.$rt" ok '{"gen_ai.system":"'"$rt"'"}'
    else
      warn "refuter $rt did not return usable JSON"; rm -f "$dir/verdicts.json"
    fi
  done

  # Quorum: a finding survives unless the refuters that looked at it agree it is
  # dead. With one refuter that is one vote — stated plainly in the report, so
  # nobody reads a single opinion as a consensus.
  #
  # A verdict only counts if it says what was checked. Observed on the first live
  # run: a schema-constrained runtime emitted five well-formed verdicts whose
  # reasoning was "Placeholder while reading the full prompt and evidence" — the
  # shape of an answer, filled in before the model had looked at anything. Those
  # arrived as `unverifiable`, which is harmless here, but the same mechanism
  # would produce a `refuted` that kills a real finding for no reason. So an
  # empty or stub `checked` field drops the vote rather than counting it.
  local quorum; quorum="$(dq_p '.panel.quorum // 1')"
  jq -s --argjson quorum "$quorum" '
      (.[0] // []) as $findings
    | ([.[1:][] | (.verdicts // [])[]
        | select(((.checked // "") | length) > 20)
        | select(((.checked // "") + " " + (.why // ""))
                 | test("placeholder|still (gathering|being|reading)|will (check|verify)|pending"; "i") | not)]
       | group_by(.id)
       | map({key: .[0].id, value: {
           refuted: (map(select(.verdict=="refuted")) | length),
           confirmed: (map(select(.verdict=="confirmed")) | length),
           unverifiable: (map(select(.verdict=="unverifiable")) | length),
           why: (map("\(.verdict): \(.why)") | join(" | "))}})
       | from_entries) as $v
    | $findings | map(. + {verdict: ($v[.id] // null)})
    | map(. + {survives: (
        if .verdict == null then true
        elif .verdict.refuted >= $quorum and .verdict.refuted > .verdict.confirmed then false
        else true end)})' \
    "$run/findings-panel.json" "$run"/refute/*/verdicts.json 2>/dev/null \
    > "$run/findings-panel-judged.json" || cp "$run/findings-panel.json" "$run/findings-panel-judged.json"

  local judged; judged="$(ls "$run"/refute/*/verdicts.json 2>/dev/null | wc -l)"
  if [[ "$judged" == 0 ]]; then
    warn "no refuter returned a usable verdict — these findings are ONE critic's opinion, unchecked"
    echo 0 > "$run/.refuters-ran"
  else
    echo "$judged" > "$run/.refuters-ran"
    note "after refutation: $(jq '[.[] | select(.survives != false)] | length' "$run/findings-panel-judged.json") of $(jq length "$run/findings-panel-judged.json") panel findings survive"
  fi
}

dq_arbitrate() { # <run>
  local run="$1"
  local pool=()
  mapfile -t pool < <(dq_pool_for arbiter)
  [[ ${#pool[@]} -eq 0 ]] && return 0

  local rt="${pool[0]}"
  local dir="$run/arbiter"; mkdir -p "$dir"
  local panel="$run/findings-panel-judged.json"
  [[ -s "$panel" ]] || panel="$run/findings-panel.json"

  jq -s '[ (.[0] // []) , (.[1] // [] | map(select(.survives != false))) ] | add
         | map({id, source, lens: (.lens // "sensor"), severity, surface, viewport,
                where: (.where // .selector // ""), title: (.title // .message),
                verdict: (.verdict // null)})' \
    "$run/findings-sensors.json" "$panel" > "$dir/pile.json"

  dq_envelope "$dir" arbiter "$rt" ""
  cat "$DQ_HOME/prompts/arbiter.md" >> "$dir/request.md"
  {
    echo
    echo "## The pile"
    echo
    echo '```json'
    cat "$dir/pile.json"
    echo '```'
    echo
  } >> "$dir/request.md"

  note "arbiter: $rt over $(jq length "$dir/pile.json") findings"
  if ! dq_call "$rt" "$dir" "$DQ_HOME/schemas/arbitration.schema.json" "" false "$run"; then
    warn "arbiter failed — the report falls back to deterministic ordering"
    dq_why_failed "$rt" "$dir"
    return 0
  fi
  dq_extract "$rt" "$dir" > "$run/arbitration.json" || {
    warn "arbiter returned nothing usable — deterministic ordering it is"
    rm -f "$run/arbitration.json"
  }
  dq_span chat "arbiter.$rt" ok '{"gen_ai.system":"'"$rt"'"}'
}
