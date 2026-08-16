.PHONY: setup up down dev smoke test images migrate brand prune visual

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

prune:
	./scripts/prune.sh

visual:
	./harness/scripts/capture-ui.sh
