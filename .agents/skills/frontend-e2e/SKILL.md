---
name: frontend-e2e
description: Create, update, and debug Playwright end-to-end tests for the tinyauth frontend package. Use when working on `packages/frontend/e2e/**`, adding or modifying E2E scenarios/configs/fixtures/helpers, running targeted Playwright projects, diagnosing flaky browser flows, or verifying auth flows such as login, registration, consent, password reset, TOTP, passkeys, and OAuth provider interactions.
---

# Frontend E2E

## Overview

Implement repository-aligned Playwright E2E tests in
`packages/frontend/e2e`. Reuse the existing scenario structure,
test fixtures, and helper modules instead of ad-hoc setup.

## Execute Workflow

1. Select the correct scenario.
- Prefer an existing scenario test directory under `e2e/tests/*`.
- If no scenario matches, create the full scenario set:
  `e2e/configs/<name>.ts`, `e2e/fixtures/<name>.ts`,
  `e2e/tests/<name>/...`, and a matching project entry in
  `playwright.config.ts`.

2. Reuse helpers before adding new selectors or flow logic.
- Prefer helper modules in `e2e/helpers/*.ts` for page actions and
  selectors.
- Keep selectors grouped by page/flow as exported `const` objects.
- Keep helper function signatures explicit and typed.

3. Use scenario fixture imports, not raw Playwright base test.
- Import `test` and `expect` from `@frontend-e2e/fixtures/<scenario>.js`.
- Keep local imports on alias paths with `.js` extension.
- Rely on the fixture-provided backend server and `baseURL`.

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
  scenario directories and fixture/config files.

## Follow Conventions

- Keep TypeScript strict; avoid type assertions and non-null assertions.
- Keep file names kebab-case.
- Keep test code ASCII unless an existing file already uses non-ASCII.
