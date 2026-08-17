.PHONY: setup up down dev smoke test images migrate brand prune visual ci ci-e2e

setup:
	./scripts/setup-local.sh

brand:
	./scripts/render-brand.sh

migrate:
	./scripts/migrate.sh

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
