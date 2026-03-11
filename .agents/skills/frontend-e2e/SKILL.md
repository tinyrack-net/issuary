---
name: frontend-e2e
description: Create, update, and debug Playwright end-to-end tests for the tinyauth frontend package. Use when working on `packages/frontend/e2e/**`, adding or modifying E2E scenarios/configs/fixtures/helpers, running targeted Playwright projects, diagnosing flaky browser flows, or verifying auth flows such as login, registration, consent, password reset, TOTP, passkeys, and OAuth provider interactions.
---

# Frontend E2E

## Overview

Implement repository-aligned Playwright E2E tests in
`packages/frontend/e2e`. Reuse the existing scenario directories,
shared helper modules, and the generic backend fixture helper instead of
reintroducing scenario-level config wrappers.

## Execute Workflow

1. Select the correct scenario.
- Prefer an existing scenario test directory under `e2e/tests/*`.
- If no scenario matches, create a new `e2e/tests/<name>/...` directory
  and a matching project entry in `playwright.config.ts`.

2. Reuse helpers before adding new selectors or flow logic.
- Prefer helper modules in `e2e/helpers/*.ts` for page actions and
  selectors.
- Keep selectors grouped by page/flow as exported `const` objects.
- Keep helper function signatures explicit and typed.

3. Define a local fixture in each spec file.
- Import `expect` from `@playwright/test`.
- Import `createScenarioFixture` from
  `@frontend-e2e/fixtures/create-scenario-fixture.js`.
- Build the backend config inline with `E2E_BASE_CONFIG` and
  `createTestAppConfig(...)` from `@frontend-e2e/fixtures/index.js`.
- Declare only the options the spec actually needs.
- If a long provider list or term list is shared across specs, extract
  only that fragment into `e2e/fragments/*.ts`.

4. Build deterministic tests.
- Wait on navigation with `waitForURL` and assert final route via
  `toHaveURL`.
- Use visible-state assertions (`toBeVisible`) for critical UI steps.
- Generate unique emails for DB-created users to avoid collisions.
- Use existing test API helpers for email/TOTP/reset token retrieval.

5. Run narrow tests first, then broader verification.
- Run one scenario+browser project while iterating:
  `pnpm test:e2e -- --project <scenario>:chromium`
- Run file-targeted checks:
  `pnpm test:e2e -- e2e/tests/<scenario>/<file>.test.ts --project <scenario>:chromium`
- Run full E2E suite when changes are stable:
  `pnpm test:e2e`

6. Apply repository verification commands before handoff.
- `pnpm build`
- `pnpm test 2>&1 | tail -200`
- `pnpm biome check .`

## Use References

- Read `references/repo-layout.md` for exact architecture and import
  patterns.
- Read `references/scenario-matrix.md` to map auth feature changes to
  scenario directories.

## Follow Conventions

- Keep TypeScript strict; avoid type assertions and non-null assertions.
- Keep file names kebab-case.
- Keep test code ASCII unless an existing file already uses non-ASCII.
