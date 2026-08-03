.PHONY: install install-e2e dev typecheck test test-e2e build preview check verify-cache verify-pwa physics-poc

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

test-e2e:
	npm run test:e2e

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

physics-poc:
	npm run poc:physics
