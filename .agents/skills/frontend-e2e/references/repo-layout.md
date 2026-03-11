# Frontend E2E Repository Layout

## Entry Points

- `playwright.config.ts`: Define projects as `<scenario>:<browser>`.
- `e2e/setup/global-setup.ts`: Start one shared Vite frontend server and
  expose `E2E_SHARED_FRONTEND_PORT`.
- `e2e/setup/create-server.ts`: Start per-worker backend server and
  register test-only endpoints.
- `e2e/fixtures/create-scenario-fixture.ts`: Generic Playwright fixture
  factory that starts the per-worker backend.
- `e2e/fixtures/index.ts`: Shared harness constants and app-config
  helpers such as `E2E_BASE_CONFIG` and `createTestAppConfig`.

## Scenario Structure

Scenarios are still grouped by directory under `e2e/tests/<scenario>`,
but each spec file declares its own backend config locally.

- `e2e/tests/<scenario>/*.test.ts`: Scenario-specific tests with local
  `const test = createScenarioFixture(...)`.
- `e2e/fragments/*.ts`: Optional shared fragments for long provider or
  terms arrays that are reused across specs.

## Import Rules

- Use `@frontend-e2e/*` alias for E2E code.
- Use `.js` extension for local ESM imports.
- Import `expect` from `@playwright/test`.
- Import `createScenarioFixture` from
  `@frontend-e2e/fixtures/create-scenario-fixture.js`.
- Import shared harness constants from
  `@frontend-e2e/fixtures/index.js`.

## Helper Layers

- `e2e/helpers/*.ts`: Reusable UI flows and selectors.
- `e2e/setup/api-client.ts`: Typed Hono test client.
- `e2e/fragments/*.ts`: Reusable config fragments for long, explicit
  test data.

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

1. Define `const test = createScenarioFixture(...)` at the top of the
   spec.
2. Build the backend config inline with `E2E_BASE_CONFIG` and
   `createTestAppConfig(...)`.
3. Declare only the options that the spec actually exercises.
4. Reuse helper selectors/functions.
5. Navigate using route paths (for example `page.goto('/login')`).
6. Wait for URL transitions explicitly.
7. Assert important UI elements with stable selectors.
8. Keep each test focused on one behavior.

## Run Commands

- Run all E2E tests:
  `pnpm test:e2e`
- Run one scenario+browser project:
  `pnpm test:e2e -- --project minimal:chromium`
- Run one spec file in one project:
  `pnpm test:e2e -- e2e/tests/minimal/login.test.ts --project minimal:chromium`
- Open Playwright UI mode:
  `pnpm test:e2e:ui`
