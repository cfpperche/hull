.PHONY: setup up down dev smoke test images migrate brand prune visual qa peer design reset ci ci-e2e

setup:
	./scripts/setup-local.sh

brand:
	./scripts/render-brand.sh

migrate:
	./scripts/migrate.sh

# Back to the demo fixture in seconds, without dropping volumes. `migrate` cannot
# do this: its seed inserts WHERE NOT EXISTS and is recorded, so it only ever
# creates the fixture when missing.
reset:
	./scripts/reset-lab.sh

images:
	./scripts/build-images.sh

up:
	./scripts/up.sh

down:
	./scripts/down.sh

dev:
	./scripts/dev.sh

smoke:
	./scripts/smoke.sh

test:
	./scripts/test.sh

# Exactly what CI runs — the workflow calls these same scripts.
ci:
	./scripts/ci.sh

ci-e2e:
	./scripts/ci-e2e.sh

prune:
	./scripts/prune.sh

visual:
	./harness/scripts/capture-ui.sh

# Exploration, not a gate. `make qa` only checks the machine is ready; drive it
# with ./harness/scripts/qa.sh start — see harness/qa.md.
qa:
	./harness/scripts/qa.sh doctor

# Asking one of the other two agents. Also not a gate, and billed per call:
# `make peer` only checks who is reachable — add --live to spend one call each
# proving they answer. Ask with ./harness/scripts/peer.sh — see harness/peer.md.
peer:
	./harness/scripts/peer.sh doctor

# Measuring the product, then putting it to a panel. `make design` reports what
# is installed and reachable; `design sense` is free and deterministic, and
# `design panel` is billed per call and is never a gate — see
# harness/design/PROTOCOL.md.
design:
	./harness/design/bin/design doctor
