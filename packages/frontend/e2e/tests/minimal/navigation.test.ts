import { expect } from '@playwright/test';
import {
  createScenarioFixture,
  gotoWithFirefoxRetry,
} from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
  E2E_TEST_USER,
  E2E_TEST_USER_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
import { performLogin } from '#frontend-e2e/helpers/login.ts';

const test = createScenarioFixture((backendPort) => ({
  ...E2E_BASE_CONFIG,
  ...createTestConfig(backendPort, {
    admin: { enabled: true },
    registration: {
      enabled: true,
      allowed_email_patterns: ['*'],
    },
  }),
  users: [E2E_TEST_USER_CONFIG],
}));

test.describe('client-side navigation', () => {
  test('keeps the auth shell and current screen while showing top progress', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    let continueNavigation = () => {};
    let markRequestStarted = () => {};
    const navigationGate = new Promise<void>((resolve) => {
      continueNavigation = resolve;
    });
    const requestStarted = new Promise<void>((resolve) => {
      markRequestStarted = resolve;
    });
    await page.route('**/register.data*', async (route) => {
      markRequestStarted();
      await navigationGate;
      await route.continue();
    });

    await page.goto('/login/password');
    await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
    expect(pageErrors).toEqual([]);
    const authShell = page.getByTestId('auth-shell');
    await authShell.evaluate((element) => {
      element.setAttribute('data-transition-marker', 'persistent');
    });

    await page.getByRole('link', { name: 'Sign up' }).click();
    await requestStarted;

    await expect(page.locator('.route-progress')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
    await expect(authShell).toHaveAttribute(
      'data-transition-marker',
      'persistent',
    );

    continueNavigation();
    await expect(
      page.getByRole('heading', { name: 'Create account' }),
    ).toBeVisible();
    await expect(page.locator('.route-progress')).toHaveCount(0);
    await expect(authShell).toHaveAttribute(
      'data-transition-marker',
      'persistent',
    );
    expect(
      await page.evaluate(
        () => performance.getEntriesByType('navigation').length,
      ),
    ).toBe(1);
  });

  test('keeps AdminShell mounted and uses its design-system progress', async ({
    browserName,
    page,
  }) => {
    await performLogin(page, E2E_TEST_USER.email, E2E_TEST_USER.password);
    await gotoWithFirefoxRetry(page, browserName, '/admin');
    await expect(page.locator('html')).toHaveAttribute('data-hydrated', 'true');
    const adminShell = page.locator('.admin-app-shell');
    await expect(
      page.getByRole('heading', {
        name: 'Services and authentication methods',
      }),
    ).toBeVisible();

    let continueNavigation = () => {};
    let markRequestStarted = () => {};
    const navigationGate = new Promise<void>((resolve) => {
      continueNavigation = resolve;
    });
    const requestStarted = new Promise<void>((resolve) => {
      markRequestStarted = resolve;
    });
    await page.route('**/admin/users.data*', async (route) => {
      markRequestStarted();
      await navigationGate;
      await route.continue();
    });

    await adminShell.evaluate((element) => {
      element.setAttribute('data-transition-marker', 'persistent');
    });
    await page.getByRole('link', { name: 'Users' }).click();
    await requestStarted;

    await expect(page.locator('.tr-app-shell-progress')).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'Services and authentication methods',
      }),
    ).toBeVisible();
    await expect(adminShell).toHaveAttribute(
      'data-transition-marker',
      'persistent',
    );

    continueNavigation();
    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(page.locator('.tr-app-shell-progress')).toHaveCount(0);
    await expect(adminShell).toHaveAttribute(
      'data-transition-marker',
      'persistent',
    );
    expect(
      await page.evaluate(
        () => performance.getEntriesByType('navigation').length,
      ),
    ).toBe(1);
  });
});
