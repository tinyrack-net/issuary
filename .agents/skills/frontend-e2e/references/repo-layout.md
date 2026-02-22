# Frontend E2E Repository Layout

## Entry Points

- `playwright.config.ts`: Define projects as `<scenario>:<browser>`.
- `e2e/setup/global-setup.ts`: Start one shared Vite frontend server and
  expose `E2E_SHARED_FRONTEND_PORT`.
- `e2e/setup/create-server.ts`: Start per-worker backend server and
  register test-only endpoints.

## Scenario Structure

For each scenario, keep these aligned:

- `e2e/configs/<scenario>.ts`: Build backend config
  (`AppConfigInput`).
- `e2e/fixtures/<scenario>.ts`: Extend Playwright `test` with
  per-worker backend and scenario `baseURL`.
- `e2e/tests/<scenario>/*.test.ts`: Scenario-specific tests.

## Import Rules

- Use `@frontend-e2e/*` alias for E2E code.
- Use `.js` extension for local ESM imports.
- Import test API from scenario fixture:
  `import { expect, test } from '@frontend-e2e/fixtures/<scenario>.js';`

## Helper Layers

- `e2e/helpers/*.ts`: Reusable UI flows and selectors.
- `e2e/setup/api-client.ts`: Typed Hono test client.
- `e2e/fixtures/index.ts`: Shared constants for default config user and
  OAuth client.

Prefer extending existing helper modules over duplicating selectors inside
tests.

## Test-only API Endpoints

`create-server.ts` registers these endpoints for deterministic tests:

- `GET /test/email-token/:email`
- `GET /test/password-reset-token/:email`
- `GET /test/totp-secret/:userSub`
- `GET /test/oauth-stub/:provider/authorize`
- `POST /test/oauth-stub/:provider/token`
- `GET /test/oauth-stub/:provider/userinfo`

Use helper wrappers (for example `helpers/email-token.ts`) whenever
available.

## Authoring Pattern

1. Start with `test.describe('<flow>')`.
2. Reuse helper selectors/functions.
3. Navigate using route paths (for example `page.goto('/login')`).
4. Wait for URL transitions explicitly.
5. Assert important UI elements with stable selectors.
6. Keep each test focused on one behavior.

## Run Commands

- Run all E2E tests:
  `pnpm test:e2e`
- Run one scenario+browser project:
  `pnpm test:e2e -- --project minimal:chromium`
- Run one spec file in one project:
  `pnpm test:e2e -- e2e/tests/minimal/login.test.ts --project minimal:chromium`
- Open Playwright UI mode:
  `pnpm test:e2e:ui`
