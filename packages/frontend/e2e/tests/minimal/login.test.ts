import { E2E_TEST_USER } from '#frontend-e2e/fixtures/index.js';
import { expect, test } from '#frontend-e2e/fixtures/minimal.js';
import {
  loginMethodPage,
  loginPasswordPage,
  performLogin,
} from '#frontend-e2e/helpers/login.js';

test.describe('Login flow', () => {
  test('redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/login');
    await expect(page).toHaveURL(/\/login/);
  });

  test('method selection page shows password login link', async ({ page }) => {
    await page.goto('/login');
    await expect(
      page.locator(loginMethodPage.passwordMethodLink),
    ).toBeVisible();
  });

  test('clicking password method navigates to password form', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.locator(loginMethodPage.passwordMethodLink).click();
    await page.waitForURL('**/login/password');

    await expect(page.locator(loginPasswordPage.emailInput)).toBeVisible();
    await expect(page.locator(loginPasswordPage.passwordInput)).toBeVisible();
    await expect(page.locator(loginPasswordPage.submitButton)).toBeVisible();
  });

  test('password login hides forgot-password link when SMTP is disabled', async ({
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

  test('full flow: method selection through login to profile', async ({
    page,
  }) => {
    await performLogin(page, E2E_TEST_USER.email, E2E_TEST_USER.password);
    await page.waitForURL('**/profile');
    await expect(page).toHaveURL(/\/profile/);
  });
});
