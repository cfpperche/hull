# Shared plumbing. Sourced by bin/design; not executable on its own.
#
# Nothing in this tree may reference the project it is pointed at. Everything
# project-shaped arrives through the profile (lib/profile.sh) — that is the only
# seam, and `design selftest` fails the build if this file grows a second one.

set -euo pipefail

DQ_VERSION="0.1.0"
DQ_HOME="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Exit codes, so a caller can branch without parsing prose.
#   0 ok                         2 a driver or a peer runtime failed
#   1 bad usage or local setup   3 findings crossed --fail-on
EX_USAGE=1 EX_TRANSPORT=2 EX_FINDINGS=3

die()  { echo "ERROR: $*" >&2; exit "${DQ_EXIT:-$EX_USAGE}"; }
note() { echo "$*" >&2; }
warn() { echo "warn: $*" >&2; }
stamp() { date +%Y%m%d-%H%M%S; }
need() { command -v "$1" >/dev/null || die "$1 is required but not on PATH${2:+ — $2}"; }

# Which agent runtime is driving this shell. Two agents sharing a machine share
# the browser session name unless something separates them, and an agent that
# takes over another's browser reports the wrong page as the product.
#
# Markers below were confirmed by asking each runtime to print its environment
# (2026-08-17: claude 2.1.233, codex-cli 0.147.0, grok 1.0.4). The fallback is a
# fixed string, never $$ — each subcommand is its own process, so a PID would
# file state under a key the next command never finds.
dq_agent_id() {
  if   [[ -n "${DESIGN_AGENT:-}" ]]; then echo "$DESIGN_AGENT"
  elif [[ -n "${CLAUDECODE:-}${CLAUDE_CODE_SESSION_ID:-}${CLAUDE_CODE_ENTRYPOINT:-}" ]]; then echo claude
  elif [[ -n "${CODEX_THREAD_ID:-}${CODEX_CI:-}${CODEX_SANDBOX_NETWORK_DISABLED:-}${CODEX_HOME:-}" ]]; then echo codex
  elif [[ -n "${GROK_AGENT:-}${GROK_SESSION_ID:-}" ]]; then echo grok
  else echo agent
  fi
}

# ── evidence trace ──────────────────────────────────────────────────────────
# One JSONL line per span, named after the OpenTelemetry GenAI semantic
# conventions (invoke_agent / execute_tool / chat, gen_ai.* attributes) so a run
# can be replayed into any tracing backend later. No collector is required and
# none is assumed: the file is the trace.
dq_span() {
  local kind="$1" name="$2" status="$3" extra="${4:-{\}}"
  [[ -n "${DQ_RUN:-}" ]] || return 0
  jq -cn --arg k "$kind" --arg n "$name" --arg s "$status" \
        --arg t "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg run "$(basename "$DQ_RUN")" \
        --argjson x "$extra" \
        '{ts:$t, run:$run, "span.kind":$k, "span.name":$n, status:$s} + $x' \
    >> "$DQ_RUN/trace.jsonl"
}

# Deterministic shuffle when a seed is given, real shuffle otherwise. Judges
# carry a position bias, so the order things are shown in is a variable — and a
# variable you cannot reproduce is a bug you cannot chase.
dq_shuffle() {
  if [[ -n "${DQ_SEED:-}" ]]; then shuf --random-source=<(yes "$DQ_SEED"); else shuf; fi
}

dq_rel() { # path relative to cwd when it is under it, absolute otherwise
  local p="$1" base="${2:-$PWD}"
  [[ "$p" == "$base"/* ]] && echo "${p#"$base"/}" || echo "$p"
}
