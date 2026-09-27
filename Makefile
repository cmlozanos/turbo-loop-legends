# Bundle sync only writes this repository; provide the canonical data directory explicitly.
.DEFAULT_GOAL := install
LEARNING_SOURCE ?=
.PHONY: sync-gates check-gates

sync-gates:
	node tools/sync-learning-gate.mjs --source "$(LEARNING_SOURCE)"

check-gates:
	node tools/sync-learning-gate.mjs --check $(if $(LEARNING_SOURCE),--source "$(LEARNING_SOURCE)")

check: check-gates

.PHONY: install install-e2e dev typecheck test test-e2e test-performance build preview check verify-cache verify-pwa verify-chrome95 verify-learning-gate physics-poc

install:
	npm ci

install-e2e:
	npx playwright install chromium webkit

dev:
	npm run dev

typecheck:
	npm run typecheck

test:
	npm test

# Includes touch.spec.ts and tools/touch-check.cjs (menus, editing, hold/release).
test-e2e:
	npm run test:e2e

test-performance:
	npm test -- tests/frameClock.test.ts tests/sceneTiming.test.ts
	npm run test:e2e -- tests/e2e/performance.spec.ts --workers=1

build:
	npm run build

preview:
	npm run preview

check:
	npm run check

verify-cache:
	npm run verify:cache

verify-pwa:
	npm run verify:pwa

verify-chrome95:
	npm run verify:chrome95

verify-learning-gate:
	npm run verify:learning-gate

physics-poc:
	npm run poc:physics
