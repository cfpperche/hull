#!/usr/bin/env bash
# Load .env the way `docker compose --env-file` does.
#
# `set -a && source .env` runs the file as shell, so an unquoted value with a
# space (HULL_BRAND=Acme Corp) becomes a command: the shell prints
# "Corp: command not found", HULL_BRAND never gets set, and the scripts fall
# back to defaults while the containers — which read the same file through
# compose — get the right value. The two views of .env must not disagree.
#
# Usage:  . "$ROOT/scripts/lib/env.sh"; hull_load_env "$ROOT/.env"

# Read one key out of .env without exporting anything. Use this when a script
# needs a single value and must not leak the rest of the operator's config into
# the process (pytest reads HULL_* through pydantic-settings, for one).
hull_env_value() {
  local file="${1:?}" want="${2:?}" line key val
  [[ -f "$file" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "$line" || "$line" == \#* ]] && continue
    key="${line%%=*}"
    key="${key#export }"
    [[ "$key" == "$want" ]] || continue
    val="${line#*=}"
    if [[ ${#val} -ge 2 && "$val" == \"*\" ]]; then
      val="${val:1:${#val}-2}"
    elif [[ ${#val} -ge 2 && "$val" == \'*\' ]]; then
      val="${val:1:${#val}-2}"
    fi
    printf '%s' "$val"
    return 0
  done <"$file"
}

hull_load_env() {
  local file="${1:?hull_load_env needs a path}" line key val
  [[ -f "$file" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" != *=* ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    key="${key#export }"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    # compose strips one layer of matching surrounding quotes, nothing else
    if [[ ${#val} -ge 2 && "$val" == \"*\" ]]; then
      val="${val:1:${#val}-2}"
    elif [[ ${#val} -ge 2 && "$val" == \'*\' ]]; then
      val="${val:1:${#val}-2}"
    fi
    printf -v "$key" '%s' "$val"
    export "${key?}"
  done <"$file"
}
