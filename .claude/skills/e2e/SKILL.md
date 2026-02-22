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
├── configs/          # Backend config per test group
├── fixtures/         # Shared test user/client data
├── helpers/          # Reusable test utilities
├── setup/            # Server initialization
│   ├── global-setup.ts   # Starts all server pairs
│   ├── create-server.ts  # Vite + Backend factory (has test routes)
│   └── api-client.ts     # Typed Hono RPC client
└── tests/<config>/   # Test files grouped by config
```

## Task: $ARGUMENTS

Read all referenced files below before writing any code.

---

## Config Pattern (`e2e/configs/<name>.ts`)

Ports: backend `1808X`, frontend `1908X` (increment X for new configs).
Check existing configs to find the next available port.

```typescript
import { E2E_TEST_CLIENT_CONFIG, E2E_TEST_USER_CONFIG } from '@frontend-e2e/fixtures/index.js';
import type { AppConfigInput } from '@tinyauth/backend/app';

export const E2E_<NAME>_PORTS = {
  backend: 1808X,
  frontend: 1908X,
} as const;

export const E2E_<NAME>_CONFIG = {
  app: {
    host: `http://localhost:${E2E_<NAME>_PORTS.backend}`,
    port: E2E_<NAME>_PORTS.backend,
    cookie_secret: '<unique-64-hex>',
    allowed_signup_emails: ['*'],
    frontend: { enabled: true, mode: 'proxy', path: `http://localhost:${E2E_<NAME>_PORTS.frontend}` },
  },
  logging: { level: 'silent', format: 'json' },
  database: { type: 'memory' },
  // Feature toggles: auth?, smtp?, terms?, signup_implicit_terms?
  users: [E2E_TEST_USER_CONFIG],
  clients: [E2E_TEST_CLIENT_CONFIG],
} as const satisfies AppConfigInput;
```

When creating a new config group, also update:
- `e2e/setup/global-setup.ts` — add `createE2EServer(config, ports)` to the `Promise.all`
- `playwright.config.ts` — add entry to `configs` array

## Helper Pattern (`e2e/helpers/*.ts`)

**Selectors** — export `const <pageName>Page = { ... } as const` with CSS selectors.
**Actions** — export `async function perform<Action>(page, ...)` for multi-step flows.

Existing helpers to reuse (read before duplicating):
- `login.ts` — `performLogin()`, `loginMethodPage`, `loginPasswordPage`, `totpSetupPage`, `totpVerifyPage`, `emailVerifyPage`
- `register-page.ts` — `performRegister()`, `registerPage`
- `register.ts` — `registerUser()` (API-based, uses Playwright `APIRequestContext` for cookie management)
- `totp.ts` — `interceptTotpSecret()`, `generateTotpCode()`, `setupTotpViaApi()`
- `pin-input.ts` — `fillPinInput()` (cross-browser sequential keyboard press)
- `email-token.ts` — `getEmailToken()` (uses typed Hono client)

## Test Pattern (`e2e/tests/<config>/<feature>.test.ts`)

```typescript
import { expect, test } from '@playwright/test';

function uniqueEmail(suffix: string): string {
  const ts = Date.now();
  return `<feature>-${suffix}-${ts}@example.com`;
}

const TEST_PASSWORD = 'test-password-123';

test.describe('Feature description', () => {
  test('specific behavior', async ({ page, request, baseURL }) => {
    // page — browser page
    // request — APIRequestContext (auto-manages cookies)
    // baseURL — backend URL (e.g. http://localhost:18080)
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

**TOTP (UI-driven):**
```typescript
const secretPromise = interceptTotpSecret(page);
// ... trigger TOTP setup
const secret = await secretPromise;
await fillPinInput(page, generateTotpCode(secret));
```

## Config-Based vs DB Users

- Config users (`E2E_TEST_USER`) — always `second_factor_required: false`, skip TOTP/email verification
- DB users — created via `registerUser()` API. Behavior depends on server config:
  - `smtp` present → `email_verification_required: true`
  - `auth.password.second_factor.required: true` → `second_factor_required: true`

## Available Test Endpoints

Defined in `create-server.ts`:
- `GET /test/email-token/:email` → `{ token: string }`
- `GET /test/totp-secret/:userSub` → `{ secret: string }`

## TypeScript

- `tsconfig.e2e.json` covers `e2e/tests` and `e2e/helpers`
- Path alias: `@frontend-e2e/*` → `./e2e/*`
- Always use `.js` extension in imports (ESM)

## Verification

After writing tests, always run:
```bash
cd packages/frontend
pnpm build                          # TypeScript check
pnpm biome check --write e2e        # Format + lint (auto-fix)
npx playwright test 2>&1 | tail -20 # Run all e2e tests
```

Kill stale servers if ports are in use:
```bash
lsof -ti:18080,18081,18082,18083,18084,19080,19081,19082,19083,19084 2>/dev/null | xargs -r kill -9
```
