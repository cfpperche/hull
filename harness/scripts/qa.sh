#!/usr/bin/env bash
# Agentic QA harness — sets the table so an agent can explore a live Hull.
#
#   ./harness/scripts/qa.sh doctor
#   ./harness/scripts/qa.sh start --persona member --taint legacy-cookie
#   eval "$(./harness/scripts/qa.sh env)"      # then drive with agent-browser
#   ./harness/scripts/qa.sh look after-signin
#   ./harness/scripts/qa.sh stop
#
# It does not wrap click/fill. Those are `agent-browser` and the agent already
# knows them (`agent-browser skills get core --full`). This script owns the four
# things that are Hull-specific, fiddly, and repeated every session: an isolated
# browser per agent, a persona signed in for real, a *tainted* starting state,
# and an evidence trail. See harness/qa.md for the protocol.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
. "$ROOT/scripts/lib/env.sh"
hull_load_env "$ROOT/.env"

HOST="${HULL_HOST:-hull.test}"
COOKIE="${HULL_COOKIE_NAME:-hull_session}"
RUNS="$ROOT/harness/qa/runs"
LAB_PASSWORD="demodemo1"

die() { echo "ERROR: $*" >&2; exit 1; }

# Which agent is driving. Three of them share this repo and `agent-browser`'s
# default session is one browser for the whole machine — without this, Codex
# navigating away mid-run would look like a Hull bug to Claude.
agent_id() {
  if [[ -n "${HULL_QA_AGENT:-}" ]]; then echo "$HULL_QA_AGENT"
  elif [[ -n "${CLAUDECODE:-}${CLAUDE_CODE_SESSION_ID:-}" ]]; then echo "claude"
  elif [[ -n "${CODEX_HOME:-}${CODEX_SANDBOX:-}" ]]; then echo "codex"
  elif [[ -n "${GROK_CLI:-}${GROK_SESSION:-}" ]]; then echo "grok"
  else echo "agent$$"
  fi
}

AGENT="$(agent_id)"
POINTER="$RUNS/.current-$AGENT"

current_run() {
  [[ -f "$POINTER" ]] || die "no run in progress for '$AGENT'. Start one: ./harness/scripts/qa.sh start"
  cat "$POINTER"
}

# ── doctor ──────────────────────────────────────────────────────────────────
# Everything this harness needs, checked before a run instead of surfacing as a
# blank screenshot ten steps in.
cmd_doctor() {
  local ok=1

  if command -v agent-browser >/dev/null; then
    echo "✓ agent-browser $(agent-browser --version 2>/dev/null | head -1)"
  else
    echo "✗ agent-browser missing — npm install -g agent-browser && agent-browser install"
    ok=0
  fi

  [[ -f "$ROOT/.env" ]] && echo "✓ .env (host ${HOST})" || { echo "✗ .env missing — cp .env.example .env"; ok=0; }

  local surface code
  for surface in "$HOST" "app.$HOST" "admin.$HOST"; do
    code=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 5 "https://${surface}/" || true)
    if [[ "$code" == "200" || "$code" == "304" ]]; then
      echo "✓ https://${surface}/ → $code"
    else
      echo "✗ https://${surface}/ → ${code:-000} — start the stack: ./scripts/up.sh"
      ok=0
    fi
  done

  # 401 is the healthy answer here: the API is up and refusing an anonymous read.
  code=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 5 "https://app.${HOST}/api/v1/me" || true)
  [[ "$code" == "401" ]] && echo "✓ api answers (/api/v1/me → 401 anonymous)" \
    || { echo "✗ api → ${code:-000}, expected 401"; ok=0; }

  if [[ "${HULL_SEED_DEMO:-1}" == "1" ]]; then
    echo "✓ lab seed on — personas member (ada@${HOST}) and admin (admin@${HOST})"
  else
    echo "✗ HULL_SEED_DEMO=0 — the personas do not exist, only --persona anon works"
    ok=0
  fi

  echo
  [[ "$ok" == 1 ]] && echo "QA_DOCTOR_OK  agent: ${AGENT}" || die "not ready — fix the ✗ above"
}

# ── start ───────────────────────────────────────────────────────────────────
sign_in() {
  local origin="$1" email="$2" proof="$3"
  agent-browser batch --bail \
    "open ${origin}/" \
    "wait --load networkidle" \
    "find testid auth-email fill ${email}" \
    "find testid auth-password fill ${LAB_PASSWORD}" \
    "find testid auth-submit click" \
    "wait --load networkidle" >/dev/null 2>&1 || true

  # Assert out of band. `agent-browser` exits 0 on a failed step, so --bail alone
  # would let a failed sign-in through and every later observation would be of
  # the login page — the exact trap capture-ui.sh fell into.
  local seen
  seen=$(agent-browser eval "!!document.querySelector('[data-testid=${proof}]')" 2>/dev/null || true)
  [[ "$seen" == *true* ]] || die "sign-in as ${email} did not take (no [data-testid=${proof}]). Is the lab seed applied (HULL_SEED_DEMO=1)?"
}

# A token the server has never issued. Shaped like a real one so the failure
# under test is "unknown session", not "malformed input".
fake_token() { head -c 24 /dev/urandom | base64 | tr -d '=+/' | cut -c1-32; }

# Every value planted below must survive RFC 6265 cookie-octet: no semicolon,
# comma, space, quote or backslash. Chrome rejects the whole call otherwise —
# and the first `junk` value here did exactly that, printed one line of CDP
# error, and left the run reporting a taint it had not applied.
cookie_is_set() {
  local want="$1"
  agent-browser cookies get --json 2>/dev/null \
    | python3 -c "import sys,json;print(any(c.get('value')==sys.argv[1] for c in json.load(sys.stdin)['data']['cookies']))" "$want"
}

plant_cookie() {
  local scope="$1" value="$2"
  case "$scope" in
    apex) agent-browser cookies set "$COOKIE" "$value" \
            --domain ".${HOST}" --path / --secure --sameSite Lax --httpOnly >/dev/null 2>&1 || true ;;
    host) agent-browser cookies set "$COOKIE" "$value" \
            --url "https://app.${HOST}" --path / --secure --sameSite Lax --httpOnly >/dev/null 2>&1 || true ;;
  esac
  # Read it back. A taint that did not take turns the whole run into a lie: the
  # report would claim a state the browser was never in.
  [[ "$(cookie_is_set "$value")" == "True" ]] \
    || die "taint not applied: Chrome would not hold that ${scope}-scoped ${COOKIE}. Nothing was tested — do not report this run."
}

cmd_start() {
  local persona="anon" taint="clean" headed=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --persona) persona="${2:?}"; shift 2 ;;
      --taint)   taint="${2:?}";   shift 2 ;;
      --headed)  headed=1;         shift ;;
      *) die "unknown flag: $1" ;;
    esac
  done

  case "$persona" in anon|member|admin) ;; *) die "persona must be anon, member or admin" ;; esac
  case "$taint" in clean|legacy-cookie|stale|junk|carry) ;; *) die "taint must be clean, legacy-cookie, stale, junk or carry" ;; esac

  command -v agent-browser >/dev/null || die "agent-browser missing — run: ./harness/scripts/qa.sh doctor"

  local run_id="${AGENT}-$(date +%Y%m%d-%H%M%S)"
  local run="$RUNS/$run_id"
  mkdir -p "$run/shots"

  local session="hull-qa-${run_id}"
  export AGENT_BROWSER_SESSION="$session"
  export AGENT_BROWSER_IGNORE_HTTPS_ERRORS=1
  [[ -n "$headed" ]] && export AGENT_BROWSER_HEADED=1

  echo "$run" >"$POINTER"
  printf '%s\n' "$session" >"$run/session"

  agent-browser close >/dev/null 2>&1 || true
  agent-browser set viewport 1440 900 >/dev/null 2>&1 || true

  # `carry` is the whole point of this harness: yesterday's browser, today's
  # build. It replaces the persona rather than layering on one — the saved state
  # already says who you were.
  if [[ "$taint" == "carry" ]]; then
    local saved="$RUNS/.state-$AGENT.json" where="https://app.${HOST}/"
    [[ -f "$saved" ]] || die "nothing to carry: no state saved yet. Finish a run with 'stop' first (it saves on the way out)."
    # Land where the last run left off, not on app. by assumption — the cookie is
    # host-scoped, so restoring an admin session and opening app. would show an
    # empty browser and read as "carry does not work".
    [[ -f "$saved.url" ]] && where="$(cat "$saved.url")"
    agent-browser open "$where" >/dev/null 2>&1 || true
    agent-browser state load "$saved" >/dev/null
    agent-browser batch --bail "open $where" "wait --load networkidle" >/dev/null 2>&1 || true
    echo "carried into: $where"
    if [[ "$persona" != "anon" ]]; then
      echo "note: --persona ${persona} ignored; carried state decides who you are"
    fi
    persona="carried"
  else
    case "$persona" in
      anon)   agent-browser batch --bail "open https://app.${HOST}/" "wait --load networkidle" >/dev/null 2>&1 || true ;;
      member) sign_in "https://app.${HOST}"   "ada@${HOST}"   "user-menu" ;;
      admin)  sign_in "https://admin.${HOST}" "admin@${HOST}" "sign-out" ;;
    esac
  fi

  local planted=""
  case "$taint" in
    legacy-cookie)
      # PR #9 in one command: a build before the host-scoped cookie left this
      # behind on the apex, and every layer that starts from an empty browser is
      # blind to it. Two cookies of the same name now go up on every request.
      plant_cookie apex "$(fake_token)"
      planted="an apex-scoped ${COOKIE} (Domain=.${HOST}) now sits beside the host-scoped one"
      ;;
    stale)
      plant_cookie host "$(fake_token)"
      planted="the host-scoped ${COOKIE} holds a token the server never issued"
      ;;
    junk)
      # Legal as a cookie value, hostile as a session id.
      plant_cookie host '../../etc/passwd<script>alert(1)</script>'
      planted="the host-scoped ${COOKIE} holds a traversal + script payload, not a token"
      ;;
  esac

  {
    echo "run:     $run_id"
    echo "agent:   $AGENT"
    echo "persona: $persona"
    echo "taint:   $taint"
    echo "session: $session"
    echo "headed:  ${headed:-0}"
  } >"$run/meta"

  cat >"$run/report.md" <<EOF
# QA run — $run_id

**Agent:** $AGENT · **Persona:** $persona · **Taint:** $taint · **Host:** $HOST

Every finding below states the state it started from. A finding without repro
steps someone else can paste is a rumour — see harness/qa.md.

## Notes

EOF

  echo "QA_START_OK  $run_id"
  echo "  persona   $persona"
  echo "  taint     $taint${planted:+  — $planted}"
  echo "  evidence  $run"
  echo
  echo "Drive it:  eval \"\$($0 env)\"  then  agent-browser snapshot -i"
  if [[ -n "$headed" ]]; then echo "A real window is open. Close it with: $0 stop"; fi
}

# ── env ─────────────────────────────────────────────────────────────────────
cmd_env() {
  local run; run="$(current_run)"
  echo "export AGENT_BROWSER_SESSION=$(cat "$run/session")"
  echo "export AGENT_BROWSER_IGNORE_HTTPS_ERRORS=1"
  echo "export HULL_QA_RUN=$run"
}

# ── look ────────────────────────────────────────────────────────────────────
# Annotated, numbered, in the run directory. Annotated because a vision model
# reading an unlabelled screenshot cannot tell you which control it means.
cmd_look() {
  local name="${1:-look}" run; run="$(current_run)"
  export AGENT_BROWSER_SESSION="$(cat "$run/session")" AGENT_BROWSER_IGNORE_HTTPS_ERRORS=1
  local n; n=$(printf '%03d' "$(( $(find "$run/shots" -name '*.png' | wc -l) + 1 ))")
  local path="$run/shots/${n}-${name}.png"
  agent-browser screenshot --annotate "$path" >/dev/null
  echo "$path"
  echo "Read that PNG. A path is not a look."
}

# ── note ────────────────────────────────────────────────────────────────────
cmd_note() {
  [[ $# -gt 0 ]] || die "note what?"
  local run; run="$(current_run)"
  printf -- '- %s\n' "$*" >>"$run/report.md"
  echo "noted → $run/report.md"
}

# ── watch ───────────────────────────────────────────────────────────────────
# The human opt-in door. Headless is the default because a run should not need a
# screen; this hands the *same live session* to a person who wants to see it, and
# they can click in it — dashboard input drives the real browser.
cmd_watch() {
  local run; run="$(current_run)"
  export AGENT_BROWSER_SESSION="$(cat "$run/session")" AGENT_BROWSER_IGNORE_HTTPS_ERRORS=1
  agent-browser stream enable >/dev/null 2>&1 || true
  agent-browser dashboard start >/dev/null 2>&1 || true
  local code; code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:4848/ || true)
  [[ "$code" == "200" ]] || die "dashboard did not come up (got ${code:-000})"
  echo "QA_WATCH_OK  http://localhost:4848  → session $(cat "$run/session")"
  echo "On WSL that URL opens from Windows as well. Keyboard and mouse there drive this session."
  echo "Stop watching:  agent-browser dashboard stop"
}

# ── stop ────────────────────────────────────────────────────────────────────
cmd_stop() {
  local run; run="$(current_run)"
  export AGENT_BROWSER_SESSION="$(cat "$run/session")" AGENT_BROWSER_IGNORE_HTTPS_ERRORS=1

  # Save on the way out so the next run can `--taint carry` into it. This is the
  # gap the harness exists to close: the bug that got through was only visible to
  # a browser that had been somewhere before.
  if agent-browser state save "$RUNS/.state-$AGENT.json" >/dev/null 2>&1; then
    agent-browser get url 2>/dev/null | tail -1 >"$RUNS/.state-$AGENT.json.url"
    echo "state saved — next run can use --taint carry"
  else
    echo "state not saved (browser already gone)"
  fi

  agent-browser dashboard stop >/dev/null 2>&1 || true
  agent-browser close >/dev/null 2>&1 || true
  rm -f "$POINTER"

  echo "QA_STOP_OK  $run"
  if [[ -s "$run/report.md" ]]; then echo "Report: $run/report.md"; fi
}

case "${1:-}" in
  doctor) shift; cmd_doctor "$@" ;;
  start)  shift; cmd_start "$@" ;;
  env)    shift; cmd_env "$@" ;;
  look)   shift; cmd_look "$@" ;;
  note)   shift; cmd_note "$@" ;;
  watch)  shift; cmd_watch "$@" ;;
  stop)   shift; cmd_stop "$@" ;;
  *)
    cat >&2 <<EOF
usage: qa.sh <command>

  doctor                          is this machine ready to explore?
  start [--persona P] [--taint T] [--headed]
        persona  anon | member | admin
        taint    clean | legacy-cookie | stale | junk | carry
  env                             export lines for the current run
  look <name>                     annotated screenshot into the run directory
  note <text>                     append a finding to the run report
  watch                           hand this session to a human (dashboard)
  stop                            save state, close, print the run directory

Protocol: harness/qa.md
EOF
    exit 2 ;;
esac
