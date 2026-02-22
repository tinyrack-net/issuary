---
name: e2e
description: Use when implementing, modifying, or debugging frontend Playwright e2e tests. Covers creating new test configs, writing test files, adding helpers, and running tests.
argument-hint: "[description of test scenario]"
---

# Frontend E2E Test Implementation Guide

You are implementing Playwright e2e tests for the tinyauth frontend.
Follow the conventions below strictly.

## Directory Structure

```
packages/frontend/e2e/
├── configs/          # Backend config factories per test group
├── fixtures/         # Playwright test fixtures (one per config)
│   └── index.ts      # Shared test user/client constants
├── helpers/          # Reusable test utilities
├── setup/            # Server initialization
│   ├── global-setup.ts   # Starts shared Vite frontend server
│   ├── create-server.ts  # Per-worker backend factory (has test routes)
│   └── api-client.ts     # Typed Hono RPC client
└── tests/<config>/   # Test files grouped by config
```

## Task: $ARGUMENTS

Read all referenced files below before writing any code.

---

## Architecture Overview

**Dynamic ports** — no static port assignments. All ports are assigned dynamically:
- **Frontend**: A single shared Vite dev server starts in `global-setup.ts` on port 0 (OS-assigned). The port is stored in `E2E_SHARED_FRONTEND_PORT` env var.
- **Backend**: Each Playwright worker gets its own backend server via `createE2EServer()`, which finds a free port dynamically.

**Server lifecycle**:
1. `global-setup.ts` starts one shared Vite frontend server (runs once before all tests)
2. Each config's fixture file calls `createE2EServer(configFactory)` per worker
3. The config factory receives `(backendPort, frontendPort)` and returns `AppConfigInput`
4. Test endpoints are registered on each backend for fetching tokens/secrets

## Existing Config Groups

| Config | Directory | Key Features |
|--------|-----------|--------------|
| `minimal` | `tests/minimal/` | Standard password auth, no 2FA, no email verification |
| `totp-required` | `tests/totp-required/` | TOTP required, email verification enabled |
| `email-verification` | `tests/email-verification/` | SMTP test mode, email verification required |
| `registration-disabled` | `tests/registration-disabled/` | `allowed_signup_emails: []` |
| `terms` | `tests/terms/` | Terms of service, email pattern filter |
| `account-deletion` | `tests/account-deletion/` | Account deletion enabled |

## Config Factory Pattern (`e2e/configs/<name>.ts`)

Configs are **factory functions** that receive dynamic ports:

```typescript
import type { AppConfigInput } from '@tinyauth/backend/app';
import {
  E2E_TEST_CLIENT_CONFIG,
  E2E_TEST_USER_CONFIG,
} from '../fixtures/index.js';

export function create<Name>Config(
  backendPort: number,
  frontendPort: number,
): AppConfigInput {
  return {
    app: {
      host: `http://localhost:${backendPort}`,
      port: backendPort,
      cookie_secret: '<unique-64-hex>',
      allowed_signup_emails: ['*'],
      frontend: {
        enabled: true,
        mode: 'proxy',
        path: `http://localhost:${frontendPort}`,
      },
    },
    logging: { level: 'silent', format: 'json' },
    database: { type: 'memory' },
    // Feature toggles: auth?, smtp?, terms?, account_deletion?
    users: [E2E_TEST_USER_CONFIG],
    clients: [E2E_TEST_CLIENT_CONFIG],
  };
}
```

## Fixture Pattern (`e2e/fixtures/<name>.ts`)

Each config group has a corresponding fixture file that starts a per-worker backend:

```typescript
import { create<Name>Config } from '@frontend-e2e/configs/<name>.js';
import { createE2EServer } from '@frontend-e2e/setup/create-server.js';
import { test as base } from '@playwright/test';

export const test = base.extend<object, { serverPort: number }>({
  serverPort: [
    // biome-ignore lint/correctness/noEmptyPattern: Playwright requires destructuring
    async ({}, use) => {
      const server = await createE2EServer(create<Name>Config);
      await use(server.backendPort);
      await server.teardown();
    },
    { scope: 'worker' },
  ],
  baseURL: async ({ serverPort }, use) => {
    await use(`http://localhost:${serverPort}`);
  },
});

export { expect } from '@playwright/test';
```

When creating a new config group, also update:
- `e2e/configs/<name>.ts` — add the config factory
- `e2e/fixtures/<name>.ts` — add the fixture file
- `playwright.config.ts` — add entry to `configs` array

## Helper Pattern (`e2e/helpers/*.ts`)

**Selectors** — export `const <pageName>Page = { ... } as const` with CSS selectors.
**Actions** — export `async function perform<Action>(page, ...)` for multi-step flows.

Existing helpers to reuse (read before duplicating):
- `login.ts` — `performLogin()`, `loginMethodPage`, `loginPasswordPage`, `totpSetupPage`, `totpVerifyPage`, `emailVerifyPage`
- `register-page.ts` — `performRegister()`, `registerPage`
- `register.ts` — `registerUser()` (API-based, uses Playwright `APIRequestContext` for cookie management)
- `consent.ts` — `navigateToOAuthAuthorize()`, `buildOAuthAuthorizeUrl()`, `consentPage`, `DEFAULT_OAUTH_PARAMS`
- `totp.ts` — `interceptTotpSecret()`, `generateTotpCode()`, `setupTotpViaApi()`
- `pin-input.ts` — `fillPinInput()` (cross-browser sequential keyboard press)
- `email-token.ts` — `getEmailToken()` (uses typed Hono client)
- `password-reset.ts` — `getPasswordResetToken()`, `forgotPasswordPage`, `resetPasswordPage`
- `profile-page.ts` — `loginAndGoToProfile()`, `profilePage`, `changePasswordModal`, `setPasswordModal`, `removePasswordModal`, `disableTotpModal`, `setupTotpModal`, `deleteAccountModal`, `modal`
- `recovery.ts` — `recoveryPage` selectors for TOTP recovery codes

## Test Pattern (`e2e/tests/<config>/<feature>.test.ts`)

Tests import `test` and `expect` from the **config-specific fixture** (not from `@playwright/test`):

```typescript
import { expect, test } from '@frontend-e2e/fixtures/<config>.js';

function uniqueEmail(suffix: string): string {
  const ts = Date.now();
  return `<feature>-${suffix}-${ts}@example.com`;
}

const TEST_PASSWORD = 'test-password-123';

test.describe('Feature description', () => {
  test('specific behavior', async ({ page, request, baseURL }) => {
    // page — browser page
    // request — APIRequestContext (auto-manages cookies)
    // baseURL — dynamically assigned backend URL
  });
});
```

### Key Patterns

**Navigation + assertion:**
```typescript
await page.waitForURL('**/profile');
await expect(page).toHaveURL(/\/profile/);
```

**Error assertion:**
```typescript
await expect(page.locator('.text-error').first()).toBeVisible();
```

**API calls** — use `getTestApiClient()` from `e2e/setup/api-client.ts`:
```typescript
import { getTestApiClient } from '@frontend-e2e/setup/api-client.js';
const client = getTestApiClient({ baseUrl: String(baseURL) });
const res = await client.api.auth.register.$post({
  header: {},
  json: { email, password },
});
```

**Multi-step API flows needing cookies** — use Playwright's `request` context:
```typescript
await registerUser(request, String(baseURL), email, password);
await setupTotpViaApi(request, String(baseURL));
```

**Email verification tokens:**
```typescript
import { getEmailToken } from '@frontend-e2e/helpers/email-token.js';
const token = await getEmailToken(String(baseURL), email);
```

**Password reset tokens:**
```typescript
import { getPasswordResetToken } from '@frontend-e2e/helpers/password-reset.js';
const token = await getPasswordResetToken(String(baseURL), email);
```

**TOTP (UI-driven):**
```typescript
const secretPromise = interceptTotpSecret(page);
// ... trigger TOTP setup
const secret = await secretPromise;
await fillPinInput(page, generateTotpCode(secret));
```

**Profile page shortcuts:**
```typescript
import { loginAndGoToProfile } from '@frontend-e2e/helpers/profile-page.js';
await loginAndGoToProfile(page, email, password);
```

## Config-Based vs DB Users

- Config users (`E2E_TEST_USER`) — always `second_factor_required: false`, skip TOTP/email verification
- DB users — created via `registerUser()` API. Behavior depends on server config:
  - `smtp` present → `email_verification_required: true`
  - `auth.password.second_factor.required: true` → `second_factor_required: true`

## Available Test Endpoints

Defined in `create-server.ts`, registered on each per-worker backend:
- `GET /test/email-token/:email` → `{ token: string }`
- `GET /test/totp-secret/:userSub` → `{ secret: string }`
- `GET /test/password-reset-token/:email` → `{ token: string }`

## TypeScript

- `tsconfig.e2e.json` covers `e2e/tests`, `e2e/helpers`, and `e2e/fixtures`
- Path alias: `@frontend-e2e/*` → `./e2e/*`
- Always use `.js` extension in imports (ESM)

## Verification

After writing tests, always run:
```bash
cd packages/backend && pnpm build   # Build backend first (e2e imports @tinyauth/backend)
cd packages/frontend
pnpm build                          # TypeScript check
pnpm biome check --write e2e        # Format + lint (auto-fix)
npx playwright test 2>&1 | tail -20 # Run all e2e tests
```
