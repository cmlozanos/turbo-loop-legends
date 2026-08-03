.PHONY: install install-e2e dev typecheck test test-e2e build preview check physics-poc

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

physics-poc:
	npm run poc:physics
