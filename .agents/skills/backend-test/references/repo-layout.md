# Backend Test Repository Layout

## Package Entry Points

- Backend package root: `packages/backend`
- Vitest config: `packages/backend/vitest.config.ts`
- Backend package scripts: `packages/backend/package.json`

## Test File Placement

- Route endpoint tests: `packages/backend/src/routes/**/<method>.test.ts`
- OAuth integration/protocol tests:
  `packages/backend/src/routes/oauth/*.test.ts`
- Service tests: `packages/backend/src/services/*.test.ts`
- Library/unit tests: `packages/backend/src/lib/*.test.ts`
- Middleware tests: `packages/backend/src/middleware/*.test.ts`

## Shared Test Utilities

Primary entry point:

- `packages/backend/src/test-utils/index.ts`

Frequently used helpers:

- `MINIMAL_TEST_CONFIG`: baseline in-memory test config
- `assertJsonBody`: status assertion + JSON parsing helper
- `expectError`: standardized error code/message assertion
- `createAuthenticatedSession`: login helper for session cookie
- `createDbUserWithSession`: DB user creation + session helper
- `withMikroContext`: RequestContext-safe DB operations
- OAuth helpers in `oauth.ts`: code exchange, token refresh/revoke,
  introspection, userinfo

Fixtures and constants:

- `packages/backend/src/test-utils/fixtures.ts`
- Contains reusable users, OAuth client config, PKCE vectors, consent
  defaults, and unique-email generation.

## Typical Test Server Pattern

Each route/service integration test file usually:

1. Declares module-level `app`, `services`, `cleanup`.
2. Creates server in `beforeAll`.
3. Uses `testClient(app)` for requests.
4. Calls `await cleanup()` in `afterAll`.

## Useful Commands

- One file:
  `cd packages/backend && pnpm test src/routes/api/auth/login/post.test.ts`
- Full backend tests:
  `cd packages/backend && pnpm test`
- Repository verification:
  `pnpm build`
  `pnpm test 2>&1 | tail -200`
  `pnpm biome check .`
