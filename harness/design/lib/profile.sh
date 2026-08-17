# The profile — the harness's only knowledge of the project it is judging.
#
# Everything project-shaped lives here: hosts, routes, how to sign in, what the
# brand is, which products to copy and which to refuse, what the budgets are.
# The tree above this file contains no project name, no host, no route and no
# credential, which is what makes it copyable: drop `design/` into another repo,
# write one profile, and the harness works there unchanged.
#
# Resolution order:  --config FILE  >  $DESIGN_PROFILE  >  ./design.config.json
#                    >  ./.design/profile.json
# The directory holding the profile is the **project root**: run directories,
# token files and relative paths all resolve from there, never from $DQ_HOME.

dq_profile_find() {
  local explicit="${1:-}"
  if [[ -n "$explicit" ]]; then
    [[ -f "$explicit" ]] || die "no profile at $explicit"
    printf '%s' "$(cd "$(dirname "$explicit")" && pwd)/$(basename "$explicit")"
    return
  fi
  if [[ -n "${DESIGN_PROFILE:-}" ]]; then dq_profile_find "$DESIGN_PROFILE"; return; fi
  local dir="$PWD"
  while [[ "$dir" != / ]]; do
    for name in design.config.json .design/profile.json; do
      [[ -f "$dir/$name" ]] && { printf '%s' "$dir/$name"; return; }
    done
    dir="$(dirname "$dir")"
  done
  die "no profile found. Write design.config.json (see $DQ_HOME/schemas/profile.schema.json) or pass --config"
}

# ${VAR} in any profile string is taken from the environment. That is how a
# profile stays valid across machines: the host, the port and the credentials
# come from the operator's own environment file, and the profile in git holds
# the shape, not the secret.
dq_expand() {
  local s="$1" out="" rest="$s"
  while [[ "$rest" =~ ^([^\$]*)\$\{([A-Za-z_][A-Za-z0-9_]*)(:-([^}]*))?\}(.*)$ ]]; do
    local pre="${BASH_REMATCH[1]}" name="${BASH_REMATCH[2]}" def="${BASH_REMATCH[4]}" post="${BASH_REMATCH[5]}"
    local val="${!name-}"
    [[ -z "$val" ]] && val="$def"
    out+="$pre$val"; rest="$post"
  done
  printf '%s' "$out$rest"
}

dq_profile_load() {
  DQ_PROFILE="$(dq_profile_find "${1:-}")"
  DQ_PROJECT_ROOT="$(dirname "$DQ_PROFILE")"
  [[ "$(basename "$DQ_PROJECT_ROOT")" == ".design" ]] && DQ_PROJECT_ROOT="$(dirname "$DQ_PROJECT_ROOT")"

  jq -e . "$DQ_PROFILE" >/dev/null 2>&1 || die "$DQ_PROFILE is not valid JSON"

  # Expand ${VAR} across every string in the document, once, up front. Later
  # reads are plain jq against the expanded copy. Without python3 the profile is
  # used verbatim and the operator is told — a ${VAR} silently surviving into a
  # URL would look like a 404 in the product rather than a missing variable here.
  if command -v python3 >/dev/null; then
    DQ_PROFILE_JSON="$(python3 - "$DQ_PROFILE" <<'PY'
import json, os, re, sys
pat = re.compile(r'\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}')
def sub(s): return pat.sub(lambda m: os.environ.get(m.group(1)) or (m.group(2) or ''), s)
def walk(v):
    if isinstance(v, str): return sub(v)
    if isinstance(v, list): return [walk(x) for x in v]
    if isinstance(v, dict): return {k: walk(x) for k, x in v.items()}
    return v
json.dump(walk(json.load(open(sys.argv[1]))), sys.stdout)
PY
    )"
  else
    DQ_PROFILE_JSON="$(cat "$DQ_PROFILE")"
    grep -q '\${' "$DQ_PROFILE" && warn "python3 is missing: \${VAR} in the profile is NOT expanded"
  fi

  for key in project surfaces; do
    echo "$DQ_PROFILE_JSON" | jq -e "has(\"$key\")" >/dev/null || die "profile is missing required key \"$key\""
  done
  [[ "$(dq_p '.surfaces | length')" -gt 0 ]] || die "profile declares no surfaces — there is nothing to look at"

  DQ_OUT="$(dq_p '.out // ".design/runs"')"
  [[ "$DQ_OUT" == /* ]] || DQ_OUT="$DQ_PROJECT_ROOT/$DQ_OUT"
  export DQ_PROFILE DQ_PROFILE_JSON DQ_PROJECT_ROOT DQ_OUT
}

# dq_p '<jq filter>' — read the loaded profile
dq_p() { echo "$DQ_PROFILE_JSON" | jq -r "$1"; }
# dq_pj '<jq filter>' — read it as JSON
dq_pj() { echo "$DQ_PROFILE_JSON" | jq -c "$1"; }

# Defaults live in one place so a thin profile still runs. Anything a project is
# likely to disagree with is a default here, not a constant in the code.
dq_budget() { # dq_budget <name> <fallback>
  local v; v="$(dq_p ".budgets.$1 // empty")"
  [[ -n "$v" && "$v" != null ]] && echo "$v" || echo "$2"
}

dq_viewports() { # name:w:h per line, from the profile or a sane pair
  local n; n="$(dq_p '.viewports | length // 0')"
  if [[ "$n" == 0 || "$n" == null ]]; then
    printf 'desktop:1440:900\nmobile:390:844\n'
  else
    dq_p '.viewports[] | "\(.name):\(.width):\(.height)"'
  fi
}

dq_surfaces() { # names, filtered by the --surface flags the caller collected
  local wanted="${1:-}"
  if [[ -z "$wanted" ]]; then dq_p '.surfaces[].name'; return; fi
  local n
  for n in ${wanted//,/ }; do
    echo "$DQ_PROFILE_JSON" | jq -er --arg n "$n" '.surfaces[] | select(.name==$n) | .name' \
      || die "no surface named \"$n\" in the profile"
  done
}

dq_surface() { # dq_surface <name> '<jq filter on the surface object>'
  echo "$DQ_PROFILE_JSON" | jq -r --arg n "$1" ".surfaces[] | select(.name==\$n) | $2"
}
