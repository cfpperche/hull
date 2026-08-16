.PHONY: setup up down dev smoke test images

setup:
	./scripts/setup-local.sh

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
