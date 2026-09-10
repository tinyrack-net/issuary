import { expect } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
  E2E_TEST_USER,
  E2E_TEST_USER_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
import { waitForAppHydration } from '#frontend-e2e/helpers/hydration.ts';
import {
  expectPasswordLoginForm,
  loginPasswordPage,
  performLogin,
} from '#frontend-e2e/helpers/login.ts';

const test = createScenarioFixture((backendPort) => ({
  ...E2E_BASE_CONFIG,
  ...createTestConfig(backendPort),
  users: [E2E_TEST_USER_CONFIG],
}));

test.describe('Login flow', () => {
  test('password form waits for JavaScript before accepting credentials', async ({
    page,
  }) => {
    let releaseScripts = () => {};
    const scripts = new Promise<void>((resolve) => {
      releaseScripts = resolve;
    });
    await page.route('**/assets/*.js', async (route) => {
      await scripts;
      await route.continue();
    });
    try {
      await page.goto('/login/password', { waitUntil: 'commit' });
      await expect(page.locator(loginPasswordPage.emailInput)).toBeDisabled();
      await expect(
        page.locator(loginPasswordPage.passwordInput),
      ).toBeDisabled();
      await expect(page.locator(loginPasswordPage.submitButton)).toBeDisabled();
      await expect(page.locator('form')).toHaveAttribute('method', 'post');
      releaseScripts();
      await waitForAppHydration(page);
      await page
        .locator(loginPasswordPage.emailInput)
        .fill(E2E_TEST_USER.email);
      await page.locator(loginPasswordPage.submitButton).click();
      await expect(page.locator(loginPasswordPage.fieldError)).toHaveText(
        'Please enter your password',
      );
      await expect(page).toHaveURL(/\/login\/password$/);
    } finally {
      releaseScripts();
      await page.unrouteAll({ behavior: 'wait' });
    }
  });

  test('redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/login**');
    await expect(page).toHaveURL(/\/login/);
  });

  test('password-only login opens the password form directly', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.waitForURL('**/login/password**');
    await expectPasswordLoginForm(page);
  });

  test('password login form is available at the direct URL', async ({
    page,
  }) => {
    await page.goto('/login/password');

    await expectPasswordLoginForm(page);
    await expect(page.locator(loginPasswordPage.passwordInput)).toBeVisible();
    await expect(page.locator(loginPasswordPage.submitButton)).toBeVisible();
  });

  test('password login hides forgot-password link when email is disabled', async ({
    page,
  }) => {
    await page.goto('/login/password');
    await expect(
      page.getByRole('link', { name: 'Forgot password?' }),
    ).toHaveCount(0);
  });

  test('successful login navigates to profile', async ({ page }) => {
    await page.goto('/login/password');
    await page.locator(loginPasswordPage.emailInput).fill(E2E_TEST_USER.email);
    await page
      .locator(loginPasswordPage.passwordInput)
      .fill(E2E_TEST_USER.password);
    await page.locator(loginPasswordPage.submitButton).click();
    await page.waitForURL('**/profile');
    await expect(page).toHaveURL(/\/profile/);
  });

  test('wrong password shows error', async ({ page }) => {
    await page.goto('/login/password');
    await page.locator(loginPasswordPage.emailInput).fill(E2E_TEST_USER.email);
    await page.locator(loginPasswordPage.passwordInput).fill('wrong-password');
    await page.locator(loginPasswordPage.submitButton).click();

    await expect(
      page.locator(loginPasswordPage.fieldError).first(),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login\/password/);
  });

  test('non-existent user shows error', async ({ page }) => {
    await page.goto('/login/password');
    await page
      .locator(loginPasswordPage.emailInput)
      .fill('nonexistent@example.com');
    await page.locator(loginPasswordPage.passwordInput).fill('anypassword');
    await page.locator(loginPasswordPage.submitButton).click();

    await expect(
      page.locator(loginPasswordPage.fieldError).first(),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login\/password/);
  });

  test('empty form submission is blocked by native validation', async ({
    page,
  }) => {
    await page.goto('/login/password');
    await page.locator(loginPasswordPage.submitButton).click();
    await expect(page).toHaveURL(/\/login\/password/);
  });

  test('empty password triggers Zod validation error', async ({ page }) => {
    await page.goto('/login/password');
    await page.locator(loginPasswordPage.emailInput).fill(E2E_TEST_USER.email);
    // Leave password empty - Zod requires min(1)
    await page.locator(loginPasswordPage.submitButton).click();

    await expect(
      page.locator(loginPasswordPage.fieldError).first(),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login\/password/);
  });

  test('full password login flow navigates to profile', async ({ page }) => {
    await performLogin(page, E2E_TEST_USER.email, E2E_TEST_USER.password);
    await page.waitForURL('**/profile');
    await expect(page).toHaveURL(/\/profile/);
  });
});
