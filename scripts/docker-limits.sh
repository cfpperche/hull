#!/usr/bin/env bash
# Cap Docker's build cache, and rotate its container logs.
#
#   ./scripts/docker-limits.sh             apply
#   ./scripts/docker-limits.sh --dry-run   show the merged file, change nothing
#   ./scripts/docker-limits.sh --self-test prove the rollback, on purpose
#
# **This is the one thing in this repo that writes machine-global state.** It is
# a separate script, and opt-in, for that reason: `/etc/docker/daemon.json`
# belongs to every project on the box, not to Hull. `setup-local.sh` deliberately
# does not call it — that script's scope is what Hull needs in order to resolve
# and be trusted, and a repository that rewrites the machine's Docker policy on
# `git clone` has reached outside its own boundary. `preflight.sh` names this
# script when the cache has grown; running it is the operator's call.
#
# Why it exists: BuildKit's stock GC policy is derived from disk size, and on a
# 1 TB volume it reads `Max Used Space: 750.6GiB`. Measured 2026-08-18 on this
# workstation: 71.7 GB of build cache, under a limit it was nowhere near. `up.sh`
# rebuilds four images every run, so this repo feeds it faster than most.
#
# Four things the manual path got wrong, on the day this was written:
#   merge, do not replace   — the daemon.json here carried an nvidia runtime
#   size from the disk      — 20 GB is a number, not a rule
#   validate before restart — `dockerd --validate` catches a malformed file
#   roll back on failure    — a bad file takes Docker down for every project,
#                             and it did: `filters expect only one value`
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

DRY=0
SELFTEST=0
case "${1:-}" in
  --dry-run|-n) DRY=1 ;;
  # The guard in this script *is* the rollback, so the only honest way to trust
  # it is to break the daemon on purpose and watch it come back. This writes the
  # exact config that took Docker down on 2026-08-18 — a GC rule carrying three
  # `type==` filters, which passes `dockerd --validate` and is refused at startup
  # with "filters expect only one value". Docker is down for the seconds between
  # the failed start and the restore. Run it when you can afford that.
  --self-test) SELFTEST=1 ;;
  "") ;;
  *) echo "usage: $0 [--dry-run | --self-test]" >&2; exit 2 ;;
esac

DAEMON=/etc/docker/daemon.json

command -v docker >/dev/null 2>&1 || { echo "ERROR: docker is not installed." >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "ERROR: python3 is needed to merge JSON safely." >&2; exit 1; }

# systemd, or this script cannot keep its promise. Without a restart it can
# verify, and without a verified restart it cannot roll back — which is the whole
# reason it is safe to run. Docker Desktop and rootless setups take a different
# path, so say so rather than write a file and hope.
if ! systemctl cat docker.service >/dev/null 2>&1; then
  echo "ERROR: docker.service is not managed by systemd here." >&2
  echo "       This script restarts Docker to verify its own change, and rolls back" >&2
  echo "       if the daemon refuses to start. It will not write a file it cannot test." >&2
  echo "       Docker Desktop: set the same limits in Settings → Docker Engine." >&2
  exit 1
fi

# ── the numbers ─────────────────────────────────────────────────────────────
# From the filesystem Docker actually stores on, not from a constant. A 20 GB
# floor is prudent on 1 TB and absurd on 64 GB.
root_dir="$(docker info --format '{{.DockerRootDir}}' 2>/dev/null || echo /var/lib/docker)"
disk_gb="$(df -BG --output=size "$root_dir" 2>/dev/null | tail -1 | tr -dc '0-9')"
disk_gb="${disk_gb:-100}"

pct() { echo $(( disk_gb * $1 / 100 )); }
clamp() { local v="$1" lo="$2" hi="$3"; ((v < lo)) && v="$lo"; ((v > hi)) && v="$hi"; echo "$v"; }

# Beyond about 20 GB a build cache is mostly layers nothing will hit again, so
# that is the ceiling — but never more than a tenth of the disk, because on a
# small one 20 GB is not a cache, it is the disk.
CACHE_GB="${HULL_DOCKER_CACHE_GB:-$(clamp "$(pct 10)" 2 20)}"
# What Docker must leave alone no matter how useful the cache looks.
FREE_GB="${HULL_DOCKER_FREE_GB:-$(clamp "$(pct 10)" 2 25)}"
# Kept even when the cache is over budget, so a rebuild is not always cold.
KEEP_GB=2
((KEEP_GB > CACHE_GB)) && KEEP_GB=$((CACHE_GB / 2))

echo "Docker root:  ${root_dir}  (${disk_gb}G volume)"
echo "Build cache:  cap ${CACHE_GB}G, keep ${KEEP_GB}G, never below ${FREE_GB}G free"
echo "Logs:         json-file, 10m × 3 per container"
echo

# ── the merged file ─────────────────────────────────────────────────────────
merged="$(mktemp)"
trap 'rm -f "$merged"' EXIT

python3 - "$DAEMON" "$merged" "$CACHE_GB" "$FREE_GB" "$KEEP_GB" "$SELFTEST" <<'PY'
import json, os, sys

src, out = sys.argv[1], sys.argv[2]
cache, free, keep, selftest = map(int, sys.argv[3:7])

# Merge, never replace. This machine's daemon.json carried an nvidia runtime, and
# a `cp` would have taken the GPU with it — silently, and days from anyone
# connecting the two.
current = {}
if os.path.exists(src):
    with open(src, encoding="utf-8") as fh:
        body = fh.read().strip()
    if body:
        current = json.loads(body)

current["log-driver"] = current.get("log-driver", "json-file")
current["log-opts"] = {**current.get("log-opts", {}), "max-size": "10m", "max-file": "3"}

# No `filter` key anywhere. BuildKit indexes filters by field, so a rule carrying
# three `type==` values is three values for one key — it passes
# `dockerd --validate`, which only checks top-level names, and then refuses at
# startup with "filters expect only one value". That took Docker down on this
# machine. The size caps are what the 71 GB needed; the per-type rule was a
# nicety, and it is not worth a second outage.
current["builder"] = {
    "gc": {
        "enabled": True,
        "policy": [
            {
                "keepDuration": "168h",
                "reservedSpace": f"{keep}GB",
                "maxUsedSpace": f"{cache}GB",
                "minFreeSpace": f"{free}GB",
            },
            {
                "reservedSpace": f"{keep}GB",
                "maxUsedSpace": f"{cache}GB",
                "minFreeSpace": f"{free}GB",
            },
            {
                "all": True,
                "reservedSpace": f"{keep}GB",
                "maxUsedSpace": f"{cache}GB",
                "minFreeSpace": f"{free}GB",
            },
        ]
    }
}

if selftest:
    # Deliberately the shape that fails: one rule, three values for `type`.
    current["builder"]["gc"]["policy"].insert(
        0,
        {
            "filter": ["type==source.local", "type==exec.cachemount", "type==source.git.checkout"],
            "keepDuration": "48h",
            "maxUsedSpace": "2GB",
        },
    )

with open(out, "w", encoding="utf-8") as fh:
    json.dump(current, fh, indent=2)
    fh.write("\n")
PY

# ── validate before anything is written ─────────────────────────────────────
# Catches a malformed file. Does *not* catch a bad key inside builder.gc.policy —
# measured: a field invented there passes this and is then ignored, or refused at
# startup. That blind spot is why the rollback below exists.
if ! dockerd --validate --config-file="$merged" >/dev/null 2>&1; then
  echo "ERROR: the merged file does not validate. Nothing was written." >&2
  dockerd --validate --config-file="$merged" >&2 || true
  exit 1
fi

if ((SELFTEST)); then
  echo "SELF-TEST: writing a config the daemon is expected to refuse."
  echo "           Docker will be down for a few seconds, then restored."
  echo
fi

if ((! SELFTEST)) && [[ -f "$DAEMON" ]] && cmp -s "$merged" "$DAEMON"; then
  echo "DOCKER_LIMITS_OK  already applied, nothing to do"
  exit 0
fi

if ((DRY)); then
  echo "--- ${DAEMON} would become ---"
  cat "$merged"
  echo "--- (dry run: nothing written) ---"
  exit 0
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Need root to write ${DAEMON} and restart Docker."
  exec sudo HULL_DOCKER_CACHE_GB="$CACHE_GB" HULL_DOCKER_FREE_GB="$FREE_GB" "$0" "$@"
fi

# ── apply, with a way back ──────────────────────────────────────────────────
backup=""
if [[ -f "$DAEMON" ]]; then
  backup="${DAEMON}.hull-$(date +%Y%m%d-%H%M%S)"
  cp "$DAEMON" "$backup"
  echo "backed up  ${backup}"
fi

install -m 0644 "$merged" "$DAEMON"
echo -n "restarting docker… "

restore() {
  if ((SELFTEST)); then
    echo "refused, as expected"
  else
    echo "FAILED"
  fi
  echo >&2
  if ((SELFTEST)); then
    echo "Rolling back, which is the thing under test." >&2
  else
    echo "The daemon refused the new file. Rolling back." >&2
  fi
  journalctl -u docker.service -n 5 --no-pager 2>/dev/null | tail -3 >&2 || true
  if [[ -n "$backup" ]]; then cp "$backup" "$DAEMON"; else rm -f "$DAEMON"; fi
  systemctl reset-failed docker >/dev/null 2>&1 || true
  systemctl restart docker || true
  sleep 3
  if docker info >/dev/null 2>&1; then
    echo >&2
    echo "Docker is back on the previous configuration. Nothing was kept." >&2
    ((SELFTEST)) && { echo; echo "SELF_TEST_OK  the rollback works"; exit 0; }
  else
    echo >&2
    echo "ERROR: Docker is still down. Check: journalctl -xeu docker.service" >&2
  fi
  exit 1
}

systemctl restart docker >/dev/null 2>&1 || restore
for _ in $(seq 1 15); do
  docker info >/dev/null 2>&1 && break
  sleep 1
done
docker info >/dev/null 2>&1 || restore
echo "up"

# Reached in --self-test only when the daemon *accepted* the broken config, which
# means the failure this script exists to survive no longer reproduces — and the
# rollback went untested. Say so loudly rather than print OK.
if ((SELFTEST)); then
  if [[ -n "$backup" ]]; then cp "$backup" "$DAEMON"; else rm -f "$DAEMON"; fi
  systemctl restart docker >/dev/null 2>&1 || true
  echo >&2
  echo "SELF_TEST_INCONCLUSIVE: the daemon accepted a config it used to refuse." >&2
  echo "  The rollback was never exercised. Previous file restored." >&2
  exit 1
fi

# ── prove the daemon read it ────────────────────────────────────────────────
# `docker info` only proves Docker started. This is the policy actually in force,
# which is the only way to know the file was not parsed and ignored.
in_force="$(docker buildx inspect default 2>/dev/null | awk '/Max Used Space/ {print $NF; exit}')"
echo
echo "GC policy in force:  Max Used Space = ${in_force:-unknown}"
if [[ -z "$in_force" ]]; then
  echo "WARNING: could not read the policy back. Check: docker buildx inspect default" >&2
fi

echo
echo "DOCKER_LIMITS_OK  cache ≤ ${CACHE_GB}G, ${FREE_GB}G always free, logs rotating"
echo "  reclaim now:  docker builder prune -f"
[[ -n "$backup" ]] && echo "  previous file: ${backup}"
