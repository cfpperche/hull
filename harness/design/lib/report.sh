# The two artefacts a run leaves behind.
#
#   report.md       for a person, ranked, with the evidence paths beside each claim
#   findings.sarif  for a machine — SARIF 2.1.0, the OASIS interchange format that
#                   code scanning, IDEs and dashboards already read
#
# SARIF is here for the same reason the profile exists: so nothing downstream has
# to know this harness. A team that wants these findings in their existing review
# surface should not need an adapter written against our JSON.
#
# The section this file cares most about is the last one — what the run could
# *not* see. A review that lists ten findings and stays silent about the four
# surfaces that failed to load reads as a clean bill of health for pages nobody
# looked at.

dq_sarif_level() {
  case "$1" in
    blocker|major) echo error ;;
    minor) echo warning ;;
    *) echo note ;;
  esac
}

dq_merge_findings() { # <run> -> findings.json (sensors + surviving panel)
  local run="$1"
  local panel="$run/findings-panel-judged.json"
  [[ -s "$panel" ]] || panel="$run/findings-panel.json"
  if [[ ! -s "$panel" ]]; then
    echo '[]' > "$run/.empty.json"
    panel="$run/.empty.json"
  fi
  [[ -s "$run/findings-sensors.json" ]] || echo '[]' > "$run/findings-sensors.json"

  jq -s '
      (.[0] // []) as $sensors
    | ((.[1] // []) | map(select(.survives != false))) as $panel
    | ($sensors | map(. + {lens: "sensor"})) + $panel
    | map({
        id, source, lens: (.lens // "sensor"),
        severity: (.severity // "minor"),
        surface: (.surface // "(all)"),
        viewport: (.viewport // "(all)"),
        where: (.where // .selector // ""),
        title: (.title // .message),
        expected: (.expected // null),
        actual: (.actual // null),
        fix: (.fix // null),
        evidence: (.evidence // null),
        confidence: (.confidence // 1.0),
        verdict: (.verdict // null),
        rule: (.rule // ("panel." + (.lens // "critic")))
      })' "$run/findings-sensors.json" "$panel" > "$run/findings.json"
  rm -f "$run/.empty.json"
}

dq_sarif() { # <run>
  local run="$1"
  jq --arg version "$DQ_VERSION" --arg project "$(dq_p .project)" '
    {
      "$schema": "https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json",
      version: "2.1.0",
      runs: [{
        tool: { driver: {
          name: "design",
          semanticVersion: $version,
          informationUri: "https://example.invalid/design-harness",
          rules: ( . | group_by(.rule) | map({
            id: .[0].rule,
            shortDescription: { text: .[0].rule },
            defaultConfiguration: { level: (if .[0].severity == "blocker" or .[0].severity == "major" then "error" elif .[0].severity == "minor" then "warning" else "note" end) },
            properties: { lens: .[0].lens, source: .[0].source }
          }))
        }},
        automationDetails: { id: $project },
        results: ( . | map({
          ruleId: .rule,
          level: (if .severity == "blocker" or .severity == "major" then "error" elif .severity == "minor" then "warning" else "note" end),
          message: { text: .title },
          partialFingerprints: { designFindingId: .id },
          locations: [{
            physicalLocation: { artifactLocation: { uri: (.surface + "@" + .viewport) } },
            logicalLocations: [{ fullyQualifiedName: (.where // ""), kind: "element" }]
          }],
          properties: {
            lens: .lens, source: .source, severity: .severity, confidence: .confidence,
            surface: .surface, viewport: .viewport,
            expected: .expected, actual: .actual, fix: .fix,
            refutation: .verdict
          }
        }))
      }]
    }' "$run/findings.json" > "$run/findings.sarif"
}

dq_report() { # <run>
  local run="$1"
  dq_merge_findings "$run"
  dq_sarif "$run"

  local out="$run/report.md"
  local project; project="$(dq_p .project)"
  local failures; failures="$(cat "$run/.observe-failures" 2>/dev/null || echo 0)"
  local n_all n_block n_major n_minor
  n_all="$(jq length "$run/findings.json")"
  n_block="$(jq '[.[] | select(.severity=="blocker")] | length' "$run/findings.json")"
  n_major="$(jq '[.[] | select(.severity=="major")] | length' "$run/findings.json")"
  n_minor="$(jq '[.[] | select(.severity=="minor")] | length' "$run/findings.json")"

  {
    echo "# Design review — $project"
    echo
    echo "**Run:** \`$(basename "$run")\` · **Harness:** design $DQ_VERSION · **Generated:** $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo
    echo "$n_all findings — $n_block blocker, $n_major major, $n_minor minor."
    echo

    if [[ -s "$run/arbitration.json" ]]; then
      echo "## Headline"
      echo
      jq -r '.headline' "$run/arbitration.json"
      echo
    fi

    if [[ -s "$run/scores.json" ]] && [[ "$(jq length "$run/scores.json")" != 0 ]]; then
      echo "## Scores"
      echo
      echo "| Lens | Runtime | Criterion | Score |"
      echo "|---|---|---|---|"
      jq -r '.[] | .lens as $l | .runtime as $r | (.scores // [])[] | "| \($l) | \($r) | \(.criterion) | \(.score)/5 |"' "$run/scores.json"
      echo
      echo "Each lens scored independently, before any comparison — a panel that"
      echo "scores by ranking against each other inherits whichever order it was shown."
      echo
      jq -r '.[] | "**\(.lens)** (\(.runtime)): \(.verdict)\n"' "$run/scores.json"
      echo
    fi

    if [[ -s "$run/arbitration.json" ]] && [[ "$(jq '.order | length' "$run/arbitration.json")" != 0 ]]; then
      echo "## Fix first"
      echo
      jq -r --slurpfile f "$run/findings.json" '
        .order | sort_by(.rank)[] | . as $o
        | ($f[0][] | select(.id == $o.id)) as $x
        | "\($o.rank). **\($x.title)** — `\($x.surface)@\($x.viewport)` \($x.where // "" | if . == "" then "" else "`" + . + "`" end)\n   \($o.because)\n   \(if $x.fix then "*Fix:* " + $x.fix else "" end)\n"' \
        "$run/arbitration.json" 2>/dev/null || true
      echo
    fi

    echo "## Findings"
    echo
    local surfaces; surfaces="$(jq -r '[.[].surface] | unique[]' "$run/findings.json")"
    local s
    while read -r s; do
      [[ -z "$s" ]] && continue
      echo "### $s"
      echo
      jq -r --arg s "$s" '
        [ .[] | select(.surface == $s) ]
        | sort_by(if .severity == "blocker" then 0 elif .severity == "major" then 1 elif .severity == "minor" then 2 else 3 end)
        | .[]
        | "- **[\(.severity)]** \(.title)  \n  `\(.viewport)`\(if .where != "" then " · `" + .where + "`" else "" end) · lens `\(.lens)` · id `\(.id)`"
          + (if .expected then "  \n  expected: \(.expected) — actual: \(.actual // "")" else "" end)
          + (if .fix then "  \n  fix: \(.fix)" else "" end)
          + (if .verdict then "  \n  refutation: \(.verdict.confirmed) confirmed / \(.verdict.refuted) refuted" else "" end)' \
        "$run/findings.json"
      echo
    done <<<"$surfaces"

    if [[ -s "$run/arbitration.json" ]] && [[ "$(jq '.disagreements | length' "$run/arbitration.json")" != 0 ]]; then
      echo "## Where the panel disagreed"
      echo
      echo "Kept visible on purpose. A panel that resolves every split silently is"
      echo "one model's opinion wearing a quorum's clothes."
      echo
      jq -r '.disagreements[] | "- **\(.about)** — \(.positions)  \n  call: \(.yourCall)"' "$run/arbitration.json"
      echo
    fi

    echo "## Evidence"
    echo
    echo "Screenshots are the record. Read them before acting on anything above."
    echo
    local p
    for p in "$run"/shots/*.png; do [[ -e "$p" ]] && echo "- \`$p\`"; done
    echo
    echo "Measured facts: \`$run/facts/\` · Trace: \`$run/trace.jsonl\` · Machine-readable: \`$run/findings.sarif\`"
    echo

    echo "## What this run could not see"
    echo
    [[ "$failures" != 0 ]] && echo "- **$failures surface(s) failed to load or failed their assertion.** They are not in the evidence and nothing above covers them."
    if [[ "$(cat "$run/.capture-mode" 2>/dev/null || echo capture)" == print-fallback ]]; then
      echo "- **The visual evidence is a print render, not a screenshot.** This host would not hand over a frame, so the pages were printed and rasterised: same DOM, paper width, no viewport. Anything above about *layout width, wrapping or the fold* is about the print layout, not about what a user sees."
    fi
    if [[ -f "$run/.refuters-ran" && "$(cat "$run/.refuters-ran")" == 0 ]] && [[ "$(jq 'length' "$run/findings-panel.json" 2>/dev/null || echo 0)" != 0 ]]; then
      echo "- **No refuter returned a verdict.** The panel findings below are one critic's opinion, unchecked by anything."
    fi
    echo "- Static captures only. Anything behind a click — hover, focus, a toast after a write, the failure path of a form — was not exercised. A finding about those is a hypothesis."
    echo "- Lab performance numbers from one cold load. INP is a field metric and is not measured here."
    echo "- Automated accessibility checks reach roughly a third of WCAG. A clean run is not a claim of conformance."
    local blind; blind="$(dq_roster | awk -F'|' '$2=="false"{print $1}' | tr '\n' ' ')"
    [[ -n "$blind" ]] && echo "- Runtimes that cannot open a screenshot in this roster: $blind. They judged from measured facts and the DOM only."
    echo
  } > "$out"

  note "report: $out"
  note "sarif:  $run/findings.sarif"
}

dq_fail_on() { # <run> <severity> -> exit code
  local run="$1" level="$2"
  [[ -z "$level" || "$level" == none ]] && return 0
  local rank_of
  case "$level" in
    blocker) rank_of=0 ;; major) rank_of=1 ;; minor) rank_of=2 ;; nit) rank_of=3 ;;
    *) die "--fail-on takes blocker|major|minor|nit|none" ;;
  esac
  local n
  n="$(jq --argjson r "$rank_of" '[.[] | select((if .severity=="blocker" then 0 elif .severity=="major" then 1 elif .severity=="minor" then 2 else 3 end) <= $r)] | length' "$run/findings.json")"
  if [[ "$n" -gt 0 ]]; then
    warn "$n findings at or above \"$level\""
    return $EX_FINDINGS
  fi
  return 0
}
