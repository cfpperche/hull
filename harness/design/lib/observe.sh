# One pass over the product: pixels and facts, from the same page state.
#
# Capture and measurement are deliberately not two commands that each drive the
# browser. A screenshot taken on one navigation and a contrast reading taken on
# the next are evidence about two different pages the moment anything is
# non-deterministic — and everything worth judging is non-deterministic
# somewhere. One navigation, one viewport, both artefacts.

# Two kinds of sensor. The in-page ones are files in sensors/ and run through a
# single eval; the driver ones are capabilities the browser tool already has and
# we would only reimplement worse. axe-core is the reference implementation of
# automated accessibility and Core Web Vitals is the reference for perceived
# performance — where the driver offers them, use them; do not write a second
# one. They are opt-in because they need the page to paint, and a host where
# painting is broken would otherwise spend a minute per surface discovering that.
DQ_DRIVER_SENSORS="axe vitals console"

dq_sensor_list() {
  local list; list="$(dq_pj '.sensors // empty')"
  if [[ -z "$list" || "$list" == null ]]; then
    echo "census contrast semantics targets overflow slop runtime console"
  else
    echo "$list" | jq -r '.[]' | tr '\n' ' '
  fi
}

dq_run_sensor() { # <name> -> JSON on stdout, or nothing
  local name="$1" body out
  case " $DQ_DRIVER_SENSORS " in
    *" $name "*) dq_run_driver_sensor "$name"; return $? ;;
  esac
  local file="$DQ_HOME/sensors/$name.js"
  [[ -f "$file" ]] || { warn "no such sensor: $name"; return 1; }
  body="$(cat "$DQ_HOME/sensors/_prelude.js" "$file")"
  out="$(drv_eval_body "$body")" || true
  if [[ -z "$out" ]] || ! jq -e . >/dev/null 2>&1 <<<"$out"; then
    warn "sensor $name returned nothing usable"
    return 1
  fi
  printf '%s' "$out"
}

dq_run_driver_sensor() { # <axe|vitals|console>
  local name="$1" raw
  case "$name" in
    axe)
      raw="$(drv_axe)" || { warn "axe is not available on this host — accessibility rests on the in-page subset"; return 1; }
      # Shape-tolerant: the driver may wrap the audit in {data:…} or return it flat.
      jq -c '(.data // .) as $d
             | { sensor: "axe", version: 1,
                 facts: { violations: (($d.violations // []) | length),
                          passes: (($d.passes // []) | length),
                          incomplete: (($d.incomplete // []) | length) },
                 findings: [ ($d.violations // [])[] as $v
                   | ($v.nodes // [{}])[0] as $n
                   | { rule: ("axe." + ($v.id // "unknown")),
                       severity: (if ($v.impact // "") == "critical" then "blocker"
                                  elif ($v.impact // "") == "serious" then "major"
                                  elif ($v.impact // "") == "moderate" then "minor" else "nit" end),
                       selector: (($n.target // [])[0] // ""),
                       message: (($v.help // $v.description // $v.id) + " — " + (($v.nodes // []) | length | tostring) + " element(s)"),
                       wcag: (($v.tags // []) | join(",")),
                       helpUrl: ($v.helpUrl // "") } ] }' <<<"$raw"
      ;;
    vitals)
      raw="$(drv_vitals)" || { warn "vitals is not available on this host"; return 1; }
      jq -c '(.data // .) as $d | { sensor: "vitals", version: 1, facts: $d, findings: [] }' <<<"$raw"
      ;;
    console)
      raw="$(drv_errors)" || return 1
      # A page that throws while a judge is calling it "clean" is the cheapest
      # finding in the harness and the one a screenshot can never show.
      jq -c '(.data // .) as $d | ($d.errors // []) as $e
             | { sensor: "console", version: 1,
                 facts: { errors: ($e | length) },
                 findings: [ $e[0:5][] | { rule: "runtime.console-error", severity: "major", selector: "",
                     message: ("the page threw: " + ((.message // .text // (. | tostring)) | tostring | .[0:160])) } ] }' <<<"$raw"
      ;;
  esac
}

# Sign-in is asserted, never assumed. A recipe that "worked" while landing on the
# sign-in page is the single most expensive failure this harness can have: every
# screenshot after it is filed under the name of a surface it never reached, and
# a panel then reviews the login page as if it were the product.
dq_auth() { # <persona>
  local persona="$1" steps
  [[ -z "$persona" || "$persona" == null || "$persona" == anon ]] && { agent-browser cookies clear >/dev/null 2>&1 || true; DQ_PERSONA=anon; return 0; }
  [[ "${DQ_PERSONA:-}" == "$persona" ]] && return 0
  steps="$(dq_pj ".auth.\"$persona\" // empty")"
  [[ -z "$steps" || "$steps" == null ]] && die "surface asks for persona \"$persona\" but the profile has no auth.$persona recipe"
  agent-browser cookies clear >/dev/null 2>&1 || true
  if ! drv_steps "$steps"; then
    DQ_EXIT=$EX_TRANSPORT die "persona \"$persona\" did not sign in — stopping. Every later shot would be the wrong page."
  fi
  DQ_PERSONA="$persona"
  dq_span execute_tool "auth.$persona" ok '{"persona":"'"$persona"'"}'
}

dq_observe() { # <run-dir> <surface filter or empty>
  local run="$1" filter="${2:-}"
  mkdir -p "$run/shots" "$run/facts" "$run/dom"
  local sensors; sensors="$(dq_sensor_list)"
  local viewports; viewports="$(dq_viewports)"
  local surfaces; surfaces="$(dq_surfaces "$filter")"
  local failures=0 shots=0

  drv_check
  drv_begin
  trap 'drv_end' EXIT

  local name
  while read -r name; do
    [[ -z "$name" ]] && continue
    local url persona assert masks want_vps
    url="$(dq_surface "$name" '.url')"
    persona="$(dq_surface "$name" '.auth // "anon"')"
    assert="$(dq_surface "$name" '.assert // empty')"
    masks="$(dq_surface "$name" '(.mask // []) | tojson')"
    want_vps="$(dq_surface "$name" '(.viewports // []) | join(" ")')"

    dq_auth "$persona"

    if ! drv_open "$url"; then
      warn "$name: could not open $url"
      dq_span execute_tool "open.$name" error '{"url":"'"$url"'"}'
      failures=$((failures + 1)); continue
    fi

    local landed; landed="$(drv_url)"
    if [[ -n "$assert" ]] && ! drv_exists "$assert"; then
      warn "$name: expected $assert in the page, landed on ${landed:-?}"
      dq_span execute_tool "assert.$name" error "$(jq -cn --arg a "$assert" --arg u "${landed:-}" '{assert:$a,landed:$u}')"
      failures=$((failures + 1)); continue
    fi

    local first=1 vp
    while read -r vp; do
      [[ -z "$vp" ]] && continue
      local vname vw vh
      IFS=: read -r vname vw vh <<<"$vp"
      [[ -n "$want_vps" && " $want_vps " != *" $vname "* ]] && continue

      drv_viewport "$vw" "$vh"
      drv_stabilise
      drv_mask "$masks"

      local png="$run/shots/$name@$vname.png" landscape=1
      [[ "$vh" -gt "$vw" ]] && landscape=0
      if drv_shot "$png" "$landscape"; then shots=$((shots + 1)); else warn "$name@$vname: no visual evidence could be captured"; failures=$((failures + 1)); fi

      local facts="{}" s
      for s in $sensors; do
        local out
        if out="$(dq_run_sensor "$s")"; then
          facts="$(jq -c --arg k "$s" --argjson v "$out" '. + {($k): $v}' <<<"$facts")"
        else
          facts="$(jq -c --arg k "$s" '. + {($k): {error:"sensor produced no result"}}' <<<"$facts")"
        fi
      done

      jq -n --arg surface "$name" --arg viewport "$vname" --arg url "$url" --arg landed "${landed:-}" \
            --arg persona "$persona" --argjson w "$vw" --argjson h "$vh" \
            --arg shot "$(dq_rel "$png" "$DQ_PROJECT_ROOT")" --arg mode "$DQ_SHOT_MODE" \
            --argjson sensors "$facts" \
        '{surface:$surface, viewport:$viewport, width:$w, height:$h, url:$url, landed:$landed,
          persona:$persona, shot:$shot, capture:$mode, sensors:$sensors}' > "$run/facts/$name@$vname.json"

      dq_span execute_tool "observe.$name@$vname" ok \
        "$(jq -cn --arg s "$name" --arg v "$vname" '{surface:$s,viewport:$v}')"

      if [[ $first == 1 ]]; then
        drv_snapshot | head -c 40000 > "$run/dom/$name.txt" || true
        first=0
      fi
    done <<<"$viewports"
  done <<<"$surfaces"

  drv_end
  trap - EXIT

  echo "$failures" > "$run/.observe-failures"
  echo "$DQ_SHOT_MODE" > "$run/.capture-mode"
  [[ "$DQ_SHOT_MODE" == print-fallback ]] && warn "visual evidence in this run is a PRINT render, not the viewport — layout width differs and the report says so"
  note "observed: $shots screenshots, $(ls "$run/facts" 2>/dev/null | wc -l) fact files, $failures failures"
  [[ $failures -gt 0 ]] && warn "a surface that failed is NOT in the evidence — do not report it as passing"
  return 0
}
