# gen-e2e-test

Generate a new Playwright E2E test file.

## Usage

```
/gen-e2e-test <name> --page <page>
```

## Arguments

- `<name>`: Test name (e.g., `settings`, `user-profile`)
- `--page <page>`: Associated page object name (e.g., `Settings`, `Profile`)

## Instructions

When the user invokes this skill:

1. Parse the name and page arguments
2. Determine the appropriate test category directory
3. Create the test file at `packages/frontend/e2e/tests/<category>/<name>.spec.ts`

### Test File Template (Basic)

```typescript
import { test, expect } from '@playwright/test';
import { <Page>Page } from '../../pages';

test.describe('<Name> Page', () => {
  let <page>Page: <Page>Page;

  test.beforeEach(async ({ page }) => {
    <page>Page = new <Page>Page(page);
    await <page>Page.goto();
  });

  test('should display the page with title', async () => {
    await <page>Page.expectPageLoaded();
    await expect(<page>Page.pageTitle).toBeVisible();
  });

  // TODO: Add more test cases
  // Example:
  // test('should show error on invalid input', async () => {
  //   await <page>Page.fillForm({ invalid: 'data' });
  //   await <page>Page.submit();
  //   await <page>Page.expectError();
  // });
});
```

### Test File Template (With Auth Fixture)

For tests requiring authentication:

```typescript
import { test, expect } from '../../fixtures';
import { <Page>Page } from '../../pages';

test.describe('<Name> Page (Authenticated)', () => {
  test('should display user data', async ({ authenticatedPage }) => {
    const <page>Page = new <Page>Page(authenticatedPage);
    await <page>Page.goto();
    await <page>Page.expectPageLoaded();
    // TODO: Add assertions
  });

  test('should update settings', async ({ authenticatedPage, testUser }) => {
    const <page>Page = new <Page>Page(authenticatedPage);
    await <page>Page.goto();
    // Use testUser.email, testUser.password for assertions
  });
});
```

### Test File Template (With Test User)

For tests that need a fresh test user:

```typescript
import { test, expect } from '../../fixtures';
import { <Page>Page } from '../../pages';

test.describe('<Name> Page', () => {
  test('should work with test user', async ({ page, testUser }) => {
    // testUser has: email, password, cleanup()
    const <page>Page = new <Page>Page(page);
    await <page>Page.goto();
    await <page>Page.login(testUser.email, testUser.password);
  });
});
```

## Test Categories

Place tests in appropriate category directories:

```
e2e/tests/
  auth/          # Login, register, logout
  password/      # Password forgot/reset
  verification/  # Email, TOTP verification
  profile/       # Profile management
  setup/         # TOTP, passkey setup
```

## Available Fixtures

From `e2e/fixtures/`:

- `testUser` - Creates a test user with email, password, cleanup()
- `authenticatedPage` - Page with logged-in session

## Common Test Patterns

### Navigation Test
```typescript
test('should navigate to other page', async ({ page }) => {
  await page.goto('/start');
  await page.click('a[href="/target"]');
  await expect(page).toHaveURL('/target');
});
```

### Form Submission Test
```typescript
test('should submit form successfully', async ({ page }) => {
  await page.fill('input[name="email"]', 'test@example.com');
  await page.click('button[type="submit"]');
  await expect(page.locator('.success')).toBeVisible();
});
```

### API Response Test
```typescript
test('should handle API error', async ({ page }) => {
  // Simulate invalid input
  await page.fill('input[name="email"]', 'invalid');
  await page.click('button[type="submit"]');
  await expect(page.locator('.alert-error')).toBeVisible();
});
```

### Redirect Test
```typescript
test('should redirect unauthenticated users', async ({ page }) => {
  await page.goto('/protected');
  await expect(page).toHaveURL('/login');
});
```

## After Generation

1. Determine correct test category directory
2. Import appropriate fixtures if auth needed
3. Add test cases for main scenarios
4. Add edge case and error tests
5. Run tests: `/test-e2e <name>`
