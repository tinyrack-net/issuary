---
name: backend-test
description: Create, update, and debug Vitest tests for the tinyauth backend package. Use when working on `packages/backend/src/**/*.test.ts`, adding route/service/lib test coverage, modifying shared backend test utilities in `packages/backend/src/test-utils/**`, investigating backend test failures, or validating OAuth/OIDC/session behavior via backend HTTP tests.
---

# Backend Test

## Overview

Implement repository-aligned backend tests with Vitest in
`packages/backend/src`. Reuse `@backend/test-utils` helpers and
in-memory test configuration instead of ad-hoc setup.

## Execute Workflow

1. Choose the correct test location.
- Route tests: colocate `get.test.ts`, `post.test.ts`, and similar files
  next to route handlers in `src/routes/**`.
- Service and utility tests: colocate `*.test.ts` files in
  `src/services/**` or `src/lib/**`.
- Keep naming aligned with file-based routing conventions.

2. Build test server setup once per file.
- In `beforeAll`, call `createServer` with
  `config: { ...MINIMAL_TEST_CONFIG, ...overrides }`.
- Keep module-level `app`, `services`, and `cleanup` variables.
- In `afterAll`, always call `await cleanup()`.
- Add only required config for the scenario (for example `users`,
  `clients`, `terms`, or auth feature toggles).

3. Prefer shared backend test utilities.
- Import from `@backend/test-utils/index.js` first.
- Use `assertJsonBody` to combine status assertion and typed JSON
  parsing.
- Use `expectError` with `@backend/schemas/error.js` for canonical
  error assertions.
- Use `createAuthenticatedSession` for config users.
- Use `createDbUserWithSession` and `generateUniqueEmail` for
  database-managed user flows.
- Use `withMikroContext` for direct database setup or mutation.
- Use OAuth helpers (`getAuthorizationCode`,
  `exchangeCodeForTokens`, `getAccessToken`, `introspectToken`,
  `revokeToken`) instead of rebuilding protocol sequences in each test.

4. Keep HTTP assertions deterministic.
- Use `testClient(app)` from `hono/testing` for route-level tests.
- Pass cookie-based auth explicitly via `Cookie: session=<value>`.
- For redirects, use `getLocationHeader(res)` and assert with `URL`.
- Assert both status and response contract for each scenario.

5. Cover boundaries, not only happy paths.
- Include authentication, authorization, and validation failures where
  relevant (`401`, `403`, `400`, and domain-specific statuses).
- For OAuth/OIDC tests, verify protocol fields (`code`, `state`,
  `error`, token activity) and consent/login preconditions.
- Add regression checks for security-sensitive behavior before closing
  the task.

6. Run narrow checks first, then repository verification.
- Run one file while iterating:
  `cd packages/backend && pnpm test src/routes/api/auth/login/post.test.ts`
- Run the package test suite when stable:
  `cd packages/backend && pnpm test`
- Apply repository verification before handoff:
  `pnpm build`
  `pnpm test 2>&1 | tail -200`
  `pnpm biome check .`

## Use References

- Read `references/repo-layout.md` for backend test file layout, key
  paths, and command targets.
- Read `references/test-recipes.md` for reusable setup patterns and
  OAuth/session test recipes.

## Follow Conventions

- Keep TypeScript strict; avoid type assertions and non-null
  assertions.
- Use `.js` extensions for local ESM imports.
- Keep tests isolated and deterministic with unique test data.
- Prefer existing helper functions over duplicated request boilerplate.
