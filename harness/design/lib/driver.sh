# Browser driver — the second seam.
#
# Everything above this file speaks in verbs (open, viewport, shot, eval, steps)
# and never in a vendor's flags, so swapping the driver is one file. The default
# is `agent-browser`: it is a CLI, it keeps a named session across processes,
# and it needs no test runner to exist in the project being judged — which is
# the whole point when the harness is pointed at a repo it knows nothing about.
#
# One measured fact governs the design here: **agent-browser exits 0 even when a
# step failed.** Every assertion in this harness therefore runs out of band, as
# an `eval` whose *value* is checked — never as a step inside a batch, and never
# as a `find`, because `find` activates what it matches (pointing one at a
# sign-out control signs the session out and every later screenshot is the login
# page).

DQ_DRIVER="${DQ_DRIVER:-agent-browser}"

drv_check() {
  case "$DQ_DRIVER" in
    agent-browser)
      command -v agent-browser >/dev/null || {
        DQ_EXIT=$EX_TRANSPORT die "agent-browser is not on PATH — npm i -g agent-browser && agent-browser install"; }
      ;;
    *) DQ_EXIT=$EX_USAGE die "driver \"$DQ_DRIVER\" is not implemented. The seam is lib/driver.sh: implement drv_open/drv_viewport/drv_shot/drv_eval/drv_steps and nothing above it changes." ;;
  esac
}

# One browser per run, named, and **never** `close --all`. That flag closes every
# session on the machine, including the one another agent is in the middle of
# driving — which then looks to them like the product navigating on its own. The
# session name carries the runtime id so two agents on one machine cannot collide.
drv_begin() {
  export AGENT_BROWSER_SESSION="${AGENT_BROWSER_SESSION:-design-$(dq_agent_id)-$$}"
  [[ "$(dq_p '.browser.ignoreHttpsErrors // false')" == "true" ]] && export AGENT_BROWSER_IGNORE_HTTPS_ERRORS=1
  agent-browser close >/dev/null 2>&1 || true
}

drv_end() { agent-browser close >/dev/null 2>&1 || true; }

drv_open() { agent-browser open "$1" >/dev/null 2>&1 || return 1; agent-browser wait --load networkidle >/dev/null 2>&1 || true; }
drv_viewport() { agent-browser set viewport "$1" "$2" >/dev/null 2>&1 || true; }
drv_snapshot() { agent-browser snapshot 2>/dev/null || true; }

# ── pixels, and what to do when the machine will not give you any ───────────
# `Page.captureScreenshot` needs the compositor to hand over a frame. On some
# headless hosts — measured here on WSL2 with Chrome headless=new, and
# reproduced with a second Chromium build and with the GPU disabled — that frame
# never arrives and the CDP call hangs until it times out. `Page.printToPDF`
# takes a different path through the renderer and works on the same host.
#
# So the capture is a chain, and every link is recorded rather than papered over:
#
#   1. screenshot            true pixels at the viewport that was measured
#   2. print → PDF → PNG     a paper render of the same DOM (needs ghostscript)
#   3. nothing               the surface is reported as having no evidence
#
# Step 2 is **not** the same picture: it is laid out for paper, so its width is
# not the viewport width and no judge should be told otherwise. Runs that fall
# back are stamped `capture.mode = print-fallback`, the report says so, and the
# panel's prompt says so, because a critique of a layout at the wrong width
# reads exactly like a critique of a broken layout.
DQ_SHOT_MODE="capture"
DQ_SHOT_TIMEOUT="${DQ_SHOT_TIMEOUT:-45}"
DQ_SHOT_WARNED=0

drv_shot() { # <path> [landscape 0|1]
  local path="$1" landscape="${2:-1}"
  # Ask once. A host that cannot produce a frame will not start producing one
  # halfway through a run, and paying the CDP timeout on every surface turns a
  # three-minute pass into a twenty-minute one.
  if [[ $DQ_SHOT_WARNED == 0 ]]; then
    if timeout "$DQ_SHOT_TIMEOUT" agent-browser screenshot "$path" >/dev/null 2>&1 && [[ -s "$path" ]]; then
      return 0
    fi
    warn "the browser would not produce a screenshot (Page.captureScreenshot timed out) — falling back to a print render for the rest of this run"
    DQ_SHOT_WARNED=1
  fi
  command -v gs >/dev/null || { warn "no ghostscript: this surface has no visual evidence at all"; return 1; }
  local pdf="${path%.png}.pdf"
  if [[ "$landscape" == 1 ]]; then
    drv_eval_body 'const s=document.createElement("style");
      s.textContent="@page{size:landscape;margin:0}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}";
      document.head.appendChild(s); return true;' >/dev/null 2>&1 || true
  fi
  timeout "$DQ_SHOT_TIMEOUT" agent-browser pdf "$pdf" >/dev/null 2>&1 || return 1
  [[ -s "$pdf" ]] || return 1
  timeout "$DQ_SHOT_TIMEOUT" gs -sDEVICE=png16m -r96 -dFirstPage=1 -dLastPage=1 \
    -dNOPAUSE -dBATCH -dQUIET -sOutputFile="$path" "$pdf" >/dev/null 2>&1 || return 1
  rm -f "$pdf"
  DQ_SHOT_MODE="print-fallback"
  [[ -s "$path" ]]
}

# Optional driver-provided sensors. agent-browser ships an axe-core audit and a
# Core Web Vitals probe; both are market-standard measurements we would
# otherwise reimplement badly. Both are also *optional* and bounded, because
# both need the page to actually paint — on a host where the screenshot chain
# above fell back, these hang. A sensor that hangs for two minutes per surface
# is worse than one that says "not available here", so they are off unless the
# profile asks for them and `design doctor` probes whether they work at all.
drv_axe() {
  local out
  out="$(timeout "${DQ_AXE_TIMEOUT:-60}" agent-browser a11y --json 2>/dev/null)" || return 1
  jq -e . >/dev/null 2>&1 <<<"$out" || return 1
  printf '%s' "$out"
}
drv_vitals() {
  local out
  out="$(timeout "${DQ_VITALS_TIMEOUT:-60}" agent-browser vitals --json 2>/dev/null)" || return 1
  jq -e . >/dev/null 2>&1 <<<"$out" || return 1
  printf '%s' "$out"
}
drv_errors() {
  local out
  out="$(timeout 20 agent-browser errors --json 2>/dev/null)" || return 1
  jq -e . >/dev/null 2>&1 <<<"$out" || return 1
  printf '%s' "$out"
}

# What actually works on this host, measured rather than assumed. `doctor` runs
# this so an operator learns about a degraded capture before a review does.
drv_probe() { # -> "screenshot=ok|fallback|none axe=ok|no vitals=ok|no"
  local tmp; tmp="$(mktemp -d)"
  local shot=none axe=no vitals=no
  agent-browser open "data:text/html,<h1>probe</h1>" >/dev/null 2>&1 || true
  if timeout 30 agent-browser screenshot "$tmp/p.png" >/dev/null 2>&1 && [[ -s "$tmp/p.png" ]]; then
    shot=ok
  elif command -v gs >/dev/null && timeout 30 agent-browser pdf "$tmp/p.pdf" >/dev/null 2>&1 && [[ -s "$tmp/p.pdf" ]]; then
    shot=fallback
  fi
  drv_axe >/dev/null 2>&1 && axe=ok
  drv_vitals >/dev/null 2>&1 && vitals=ok
  rm -rf "$tmp"
  echo "screenshot=$shot axe=$axe vitals=$vitals"
}
drv_url() { agent-browser get url 2>/dev/null | tr -d '"' | tail -1; }

# Evaluate a function *body* (the sensors are bodies, not programs) and print
# whatever it returns as JSON.
drv_eval_body() {
  local body="$1"
  agent-browser eval "(() => { $body })()" 2>/dev/null
}
drv_eval_async() {
  local body="$1"
  agent-browser eval "(async () => { $body })()" 2>/dev/null
}

# True/false assertion that cannot be faked by an exit code.
drv_exists() {
  local css="$1" lit out
  lit="$(jq -Rn --arg s "$css" '$s')"   # JSON-quote it; bash's @Q is not JS-safe
  out="$(agent-browser eval "!!document.querySelector($lit)" 2>/dev/null || true)"
  [[ "$out" == *true* ]]
}

# ── driver-neutral steps ────────────────────────────────────────────────────
# A profile describes signing in as a list of verbs, not as agent-browser flags,
# so the recipe survives a driver swap. Locators: testid | css | text | role+name.
drv_locator() { # -> "kind value" for agent-browser find
  local loc="$1"
  local testid css text role name
  testid="$(echo "$loc" | jq -r '.testid // empty')"
  css="$(echo "$loc" | jq -r '.css // empty')"
  text="$(echo "$loc" | jq -r '.text // empty')"
  role="$(echo "$loc" | jq -r '.role // empty')"
  name="$(echo "$loc" | jq -r '.name // empty')"
  if   [[ -n "$testid" ]]; then echo "testid|$testid"
  elif [[ -n "$css"    ]]; then echo "css|$css"
  elif [[ -n "$text"   ]]; then echo "text|$text"
  elif [[ -n "$role"   ]]; then echo "role|$role${name:+|$name}"
  else die "a step locator must name testid, css, text or role"
  fi
}

drv_css_for() { # best-effort CSS for an assertion
  local loc="$1" testid css
  testid="$(echo "$loc" | jq -r '.testid // empty')"
  css="$(echo "$loc" | jq -r '.css // empty')"
  [[ -n "$testid" ]] && { echo "[data-testid=\"$testid\"]"; return; }
  [[ -n "$css" ]] && { echo "$css"; return; }
  echo ""
}

drv_steps() { # drv_steps '<json array of steps>'
  local steps="$1" i n
  n="$(echo "$steps" | jq 'length')"
  for ((i = 0; i < n; i++)); do
    local step; step="$(echo "$steps" | jq -c ".[$i]")"
    local verb; verb="$(echo "$step" | jq -r 'keys_unsorted[0]')"
    case "$verb" in
      open)  drv_open "$(echo "$step" | jq -r '.open')" || return 1 ;;
      wait)
        local w; w="$(echo "$step" | jq -r '.wait')"
        if [[ "$w" =~ ^[0-9]+$ ]]; then agent-browser wait "$w" >/dev/null 2>&1 || true
        else agent-browser wait --load "$w" >/dev/null 2>&1 || true; fi ;;
      fill|type)
        local kv value; kv="$(drv_locator "$(echo "$step" | jq -c ".$verb")")"
        value="$(echo "$step" | jq -r '.value // ""')"
        IFS='|' read -r kind sel_v extra <<<"$kv"
        if [[ "$kind" == css ]]; then agent-browser fill "$sel_v" "$value" >/dev/null 2>&1 || true
        else agent-browser find "$kind" "$sel_v" fill "$value" >/dev/null 2>&1 || true; fi ;;
      click)
        local kv; kv="$(drv_locator "$(echo "$step" | jq -c '.click')")"
        IFS='|' read -r kind sel_v extra <<<"$kv"
        if [[ "$kind" == css ]]; then agent-browser click "$sel_v" >/dev/null 2>&1 || true
        else agent-browser find "$kind" "$sel_v" click >/dev/null 2>&1 || true; fi
        agent-browser wait --load networkidle >/dev/null 2>&1 || true ;;
      press) agent-browser press "$(echo "$step" | jq -r '.press')" >/dev/null 2>&1 || true ;;
      hover)
        local kv; kv="$(drv_locator "$(echo "$step" | jq -c '.hover')")"
        IFS='|' read -r kind sel_v extra <<<"$kv"
        if [[ "$kind" == css ]]; then agent-browser hover "$sel_v" >/dev/null 2>&1 || true
        else agent-browser find "$kind" "$sel_v" hover >/dev/null 2>&1 || true; fi ;;
      eval)  agent-browser eval "$(echo "$step" | jq -r '.eval')" >/dev/null 2>&1 || true ;;
      cookies) agent-browser cookies clear >/dev/null 2>&1 || true ;;
      # The only step that can fail the recipe. Everything above is best effort
      # because the driver will not tell us; this one asks the page directly.
      assert)
        local css; css="$(echo "$step" | jq -r '.assert')"
        drv_exists "$css" || { warn "assertion failed: $css is not in the page"; return 1; }
        ;;
      *) die "unknown step verb \"$verb\"" ;;
    esac
  done
}

# ── determinism ─────────────────────────────────────────────────────────────
# Screenshots are compared across runs and read by judges, so the same page must
# produce the same pixels: animations fast-forwarded, carets hidden, fonts
# settled, scrolling reset, and whatever the profile declares as volatile
# painted out. Time is *not* frozen — that needs cooperation from the app, and a
# harness that pretends otherwise produces baselines that drift by the hour.
DQ_STABILISE_JS='
  // Reuse the node. Injecting a fresh <style id="__dq_stabilise"> per viewport
  // made the harness plant a duplicate id and then report it — caught on the
  // first real run, against a page that had no duplicate ids of its own. A
  // sensor that measures the instrument is worse than no sensor.
  const s = document.getElementById("__dq_stabilise") || document.createElement("style");
  s.id = "__dq_stabilise";
  s.textContent = `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;
    animation-iteration-count:1!important;transition-duration:0s!important;transition-delay:0s!important;
    caret-color:transparent!important;scroll-behavior:auto!important}
    ::-webkit-scrollbar{display:none!important}`;
  if (!s.isConnected) document.head.appendChild(s);
  window.scrollTo(0,0);
  try { await document.fonts.ready; } catch (e) {}
  await new Promise(r => setTimeout(r, 80));
  return {stabilised:true, fonts:(document.fonts && document.fonts.status) || "unknown"};
'
# The settle above is a timer, not requestAnimationFrame. Measured here on
# 2026-08-17: a headless page that is not being presented never fires rAF, so
# `await new Promise(r => requestAnimationFrame(r))` hangs until the CDP call
# times out and takes the whole run with it. A short timer settles layout after
# the injected stylesheet without depending on a frame that may never come.

drv_stabilise() {
  drv_eval_async "$DQ_STABILISE_JS" >/dev/null || warn "could not stabilise the page — screenshots may differ between runs"
}

drv_mask() { # drv_mask '["sel", ...]' — paint volatile regions flat before the shot
  local masks="$1"
  [[ "$masks" == "[]" || -z "$masks" || "$masks" == null ]] && return 0
  drv_eval_body "
    const sels = $masks;
    const st = document.getElementById('__dq_mask') || document.createElement('style');
    st.id = '__dq_mask';
    st.textContent = sels.map(s => s + '{background:#FF00FF!important;color:transparent!important;border-color:#FF00FF!important;}').join('\n');
    document.head.appendChild(st);
    return {masked: sels.length};
  " >/dev/null
}
