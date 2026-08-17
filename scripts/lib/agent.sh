#!/usr/bin/env bash
# Which agent runtime is driving this shell.
#
# Usage:  . "$ROOT/scripts/lib/agent.sh"; hull_detect_agent
#         → HULL_AGENT_ID    claude | codex | grok | agent
#         → HULL_AGENT_GUESSED  1 when nothing matched and the fallback is in use
#
# Three runtimes share this repo and several harnesses key per-agent state off
# the answer (a browser session in qa.sh, an exchange pointer in peer.sh), so a
# wrong answer is not cosmetic: two agents collide on one key.
#
# The markers below are *confirmed*, not guessed — on 2026-08-17 each runtime was
# asked to print its own environment (claude 2.1.233, codex-cli 0.147.0,
# grok 1.0.4):
#
#   claude  CLAUDECODE, CLAUDE_CODE_SESSION_ID, CLAUDE_CODE_ENTRYPOINT, CLAUDE_PID
#   codex   CODEX_THREAD_ID, CODEX_CI, CODEX_SANDBOX_NETWORK_DISABLED
#   grok    GROK_AGENT, GROK_SESSION_ID
#
# Keep that provenance when editing. `harness/scripts/qa.sh` predates this file
# and carries its own copy of the guess, which looks for CODEX_SANDBOX and
# GROK_CLI — neither exists — so it detects only Claude. Whoever next touches
# qa.sh should delete that block and source this one.
#
# The fallback is the fixed string `agent`, never $$: callers run one command per
# process (`start` in one shell, `env` in the next), so a PID would file state
# under a key the next command never finds.

hull_detect_agent() {
  HULL_AGENT_GUESSED=0

  # An explicit answer wins. HULL_QA_AGENT is honoured as well so an operator who
  # exported it for qa.sh does not get a different identity from peer.sh.
  if [[ -n "${HULL_AGENT:-}" ]]; then
    HULL_AGENT_ID="$HULL_AGENT"
  elif [[ -n "${HULL_QA_AGENT:-}" ]]; then
    HULL_AGENT_ID="$HULL_QA_AGENT"
  elif [[ -n "${CLAUDECODE:-}${CLAUDE_CODE_SESSION_ID:-}${CLAUDE_CODE_ENTRYPOINT:-}" ]]; then
    HULL_AGENT_ID="claude"
  elif [[ -n "${CODEX_THREAD_ID:-}${CODEX_CI:-}${CODEX_SANDBOX_NETWORK_DISABLED:-}${CODEX_HOME:-}" ]]; then
    HULL_AGENT_ID="codex"
  elif [[ -n "${GROK_AGENT:-}${GROK_SESSION_ID:-}" ]]; then
    HULL_AGENT_ID="grok"
  else
    HULL_AGENT_ID="agent"
    HULL_AGENT_GUESSED=1
  fi

  export HULL_AGENT_ID HULL_AGENT_GUESSED
}
