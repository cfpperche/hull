# Facts → findings, deterministically.
#
# The split this file defends: **a sensor reports what is true, a rule decides
# what is wrong.** Contrast 2.1:1 is true everywhere; "eleven type sizes" is
# true everywhere; whether eleven sizes is a defect depends on the project, and
# that decision lives in the profile's budgets. Keeping the judgement out of the
# sensors is what lets the same tree run against a marketing site and a dense
# console without either one being permanently wrong.
#
# Everything here is reproducible: same facts in, same findings out, no model
# involved. This layer is the one you could put in front of a merge. The panel
# that comes after it is not — see PROTOCOL.md.

dq_fid() { printf '%s' "$1" | sha1sum | cut -c1-10; }

dq_finding() { # rule severity surface viewport selector message extra-json
  local rule="$1" sev="$2" surface="$3" viewport="$4" selector="$5" message="$6" extra="${7:-{\}}"
  local id; id="$(dq_fid "$rule|$surface|$viewport|$selector|$message")"
  jq -cn --arg id "$id" --arg rule "$rule" --arg sev "$sev" --arg s "$surface" --arg v "$viewport" \
        --arg sel "$selector" --arg m "$message" --argjson x "$extra" \
    '{id:$id, rule:$rule, source:"sensor", severity:$sev, surface:$s, viewport:$v,
      selector:$sel, message:$m, evidence:$x, confidence:1.0}'
}

# ── budgets ─────────────────────────────────────────────────────────────────
dq_rules_budgets() { # <facts file> -> findings on stdout, one JSON per line
  local f="$1"
  local surface viewport shot
  surface="$(jq -r .surface "$f")"; viewport="$(jq -r .viewport "$f")"; shot="$(jq -r .shot "$f")"

  local type_max fam_max rad_max shadow_max pal_max offgrid_max slop_max dom_max
  type_max="$(dq_budget typeScaleMax 6)"
  fam_max="$(dq_budget fontFamiliesMax 2)"
  rad_max="$(dq_budget radiiMax 4)"
  shadow_max="$(dq_budget shadowsMax 4)"
  pal_max="$(dq_budget paletteMax 18)"
  offgrid_max="$(dq_budget spacingOffGridMax 3)"
  slop_max="$(dq_budget slopWeightMax 4)"
  dom_max="$(dq_budget domNodesMax 2500)"

  local n
  n="$(jq -r '.sensors.census.facts.typeScaleCount // 0' "$f")"
  if [[ "$n" -gt "$type_max" ]]; then
    dq_finding "budget.type-scale" major "$surface" "$viewport" "" \
      "$n distinct font sizes render on this view; the budget is $type_max" \
      "$(jq -c '{sizes: (.sensors.census.facts.typeScale // [] | .[0:12]), budget: '"$type_max"'}' "$f")"
  fi

  n="$(jq -r '(.sensors.census.facts.fontFamilies // []) | length' "$f")"
  if [[ "$n" -gt "$fam_max" ]]; then
    dq_finding "budget.font-families" major "$surface" "$viewport" "" \
      "$n font families on one view; the budget is $fam_max" \
      "$(jq -c '{families: (.sensors.census.facts.fontFamilies // []), budget: '"$fam_max"'}' "$f")"
  fi

  n="$(jq -r '.sensors.census.facts.radiiCount // 0' "$f")"
  if [[ "$n" -gt "$rad_max" ]]; then
    dq_finding "budget.radii" minor "$surface" "$viewport" "" \
      "$n distinct corner radii; the budget is $rad_max — a shape language is a choice, not an accident" \
      "$(jq -c '{radii: (.sensors.census.facts.radii // []), budget: '"$rad_max"'}' "$f")"
  fi

  n="$(jq -r '.sensors.census.facts.shadowCount // 0' "$f")"
  if [[ "$n" -gt "$shadow_max" ]]; then
    dq_finding "budget.shadows" minor "$surface" "$viewport" "" \
      "$n distinct shadows; the budget is $shadow_max — elevation stops meaning anything past a handful" \
      "$(jq -c '{shadows: (.sensors.census.facts.shadows // []), budget: '"$shadow_max"'}' "$f")"
  fi

  n="$(jq -r '.sensors.census.facts.paletteCount // 0' "$f")"
  if [[ "$n" -gt "$pal_max" ]]; then
    dq_finding "budget.palette" minor "$surface" "$viewport" "" \
      "$n distinct colours in use; the budget is $pal_max" \
      "$(jq -c '{palette: (.sensors.census.facts.palette // [] | .[0:16]), budget: '"$pal_max"'}' "$f")"
  fi

  n="$(jq -r '(.sensors.census.facts.spacingOffGrid // []) | length' "$f")"
  if [[ "$n" -gt "$offgrid_max" ]]; then
    dq_finding "budget.spacing-grid" minor "$surface" "$viewport" "" \
      "$n spacing values sit off the $(jq -r '.sensors.census.facts.spacingGrid // 4' "$f")px grid" \
      "$(jq -c '{offGrid: (.sensors.census.facts.spacingOffGrid // []), budget: '"$offgrid_max"'}' "$f")"
  fi

  # The heading ladder that exists only in the markup.
  if [[ "$(jq -r '(.sensors.census.facts.headingCollapse // []) | length' "$f")" -gt 0 ]]; then
    dq_finding "hierarchy.heading-collapse" major "$surface" "$viewport" "" \
      "headings at different levels render identically — the hierarchy is in the HTML, not on the screen" \
      "$(jq -c '{collapsed: .sensors.census.facts.headingCollapse, ladder: .sensors.census.facts.headingLadder}' "$f")"
  fi

  n="$(jq -r '.sensors.slop.facts.slopWeight // 0' "$f")"
  if [[ "$n" -gt "$slop_max" ]]; then
    dq_finding "identity.distributional" major "$surface" "$viewport" "" \
      "$n points of distributional tells (budget $slop_max): $(jq -r '(.sensors.slop.facts.tells // []) | join(", ")' "$f")" \
      "$(jq -c '{tells: (.sensors.slop.tells // []), weight: '"$n"', budget: '"$slop_max"',
                 note: "priors, not proof — the identity critic decides whether this is the brand or the model"}' "$f")"
  fi

  n="$(jq -r '.sensors.runtime.facts.domNodes // 0' "$f")"
  if [[ "$n" -gt "$dom_max" ]]; then
    dq_finding "budget.dom-size" minor "$surface" "$viewport" "" \
      "$n DOM nodes on one view (budget $dom_max)" "$(jq -cn '{nodes:'"$n"', budget:'"$dom_max"'}')"
  fi
}

# ── sensor findings ─────────────────────────────────────────────────────────
# When axe-core ran, its verdict wins on the checks it covers and the in-page
# equivalents are dropped. Running both does not double the coverage; it doubles
# the noise, and the operator has to work out which of two rows about the same
# missing label to believe. What stays is what axe does not check: contrast is
# kept because this harness reports the *pair* and the ratio rather than one row
# per paragraph, and focus-visible, placeholder-as-label and vague link text
# have no axe rule at all.
DQ_AXE_COVERS="a11y.img-alt a11y.control-name a11y.html-lang a11y.duplicate-id a11y.zoom-blocked a11y.heading-order a11y.tabindex-positive a11y.title a11y.heading-h1"

dq_rules_sensor_findings() { # <facts file>
  local f="$1"
  local drop='[]'
  if jq -e '.sensors.axe.facts' "$f" >/dev/null 2>&1; then
    drop="$(printf '%s\n' $DQ_AXE_COVERS | jq -Rsc 'split("\n") | map(select(length>0))')"
  fi
  jq -c --arg surface "$(jq -r .surface "$f")" --arg viewport "$(jq -r .viewport "$f")" --argjson drop "$drop" '
    [ .sensors | to_entries[] | .key as $sensor | (.value.findings // [])[]
      | select((.rule // "") as $r | ($drop | index($r)) == null)
      | { rule: .rule, severity: (.severity // "minor"), surface: $surface, viewport: $viewport,
          selector: (.selector // ""), message: .message, source: "sensor", confidence: 1.0,
          evidence: (del(.rule, .severity, .selector, .message)) } ] | .[]' "$f" \
  | while read -r line; do
      local id
      id="$(dq_fid "$(jq -r '"\(.rule)|\(.surface)|\(.viewport)|\(.selector)|\(.message)"' <<<"$line")")"
      jq -c --arg id "$id" '{id:$id} + .' <<<"$line"
    done
}

# ── consistency across surfaces ─────────────────────────────────────────────
# The defect nobody sees on one screen: two surfaces of the same product using
# different type scales, radii or accents. It is invisible to a per-page review
# and to a per-page judge, which is exactly why it survives so long in products.
dq_rules_consistency() { # <run dir>
  local run="$1"
  local files; files=$(ls "$run"/facts/*.json 2>/dev/null || true)
  [[ -z "$files" ]] && return 0
  local fam_max rad_max
  fam_max="$(dq_budget fontFamiliesMax 2)"
  rad_max="$(dq_budget radiiMax 4)"

  local fams rads accents
  fams="$(jq -sc '[.[] | .sensors.census.facts.fontFamilies[0].value // empty] | unique' "$run"/facts/*.json)"
  rads="$(jq -sc '[.[] | (.sensors.census.facts.radii // [])[].value] | unique' "$run"/facts/*.json)"
  accents="$(jq -sc '[.[] | (.sensors.slop.facts.accentColors // [])[0].value // empty] | unique' "$run"/facts/*.json)"

  local n
  n="$(jq 'length' <<<"$fams")"
  if [[ "$n" -gt "$fam_max" ]]; then
    dq_finding "consistency.type" major "(all)" "(all)" "" \
      "$n different dominant font families across the surfaces in this run" \
      "$(jq -cn --argjson f "$fams" '{families:$f}')"
  fi
  n="$(jq 'length' <<<"$rads")"
  if [[ "$n" -gt "$rad_max" ]]; then
    dq_finding "consistency.shape" minor "(all)" "(all)" "" \
      "$n different corner radii across the surfaces in this run" \
      "$(jq -cn --argjson r "$rads" '{radii:$r}')"
  fi
  n="$(jq 'length' <<<"$accents")"
  if [[ "$n" -gt 1 ]]; then
    dq_finding "consistency.accent" minor "(all)" "(all)" "" \
      "the primary accent colour is not the same on every surface" \
      "$(jq -cn --argjson a "$accents" '{accents:$a}')"
  fi
}

dq_rules_all() { # <run dir> -> findings-sensors.json
  local run="$1" f
  : > "$run/.findings-sensors.jsonl"
  for f in "$run"/facts/*.json; do
    [[ -e "$f" ]] || continue
    dq_rules_sensor_findings "$f" >> "$run/.findings-sensors.jsonl"
    dq_rules_budgets "$f" >> "$run/.findings-sensors.jsonl"
  done
  dq_rules_consistency "$run" >> "$run/.findings-sensors.jsonl"
  jq -s '.' "$run/.findings-sensors.jsonl" > "$run/findings-sensors.json"
  rm -f "$run/.findings-sensors.jsonl"
  note "deterministic findings: $(jq length "$run/findings-sensors.json")"
}
