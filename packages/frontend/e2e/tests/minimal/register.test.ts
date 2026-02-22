import { expect, test } from '@frontend-e2e/fixtures/minimal.js';
import {
  performRegister,
  registerPage,
} from '@frontend-e2e/helpers/register-page.js';

/**
 * Generates a unique test email for each test to avoid collisions.
 */
function uniqueEmail(suffix: string): string {
  const ts = Date.now();
  return `register-minimal-${suffix}-${ts}@example.com`;
}

const TEST_PASSWORD = 'test-password-123';

test.describe('Registration flow (minimal config)', () => {
  test('registration page shows form elements', async ({ page }) => {
    await page.goto('/register');

    await expect(page.locator(registerPage.emailInput)).toBeVisible();
    await expect(page.locator(registerPage.passwordInput)).toBeVisible();
    await expect(page.locator(registerPage.submitButton)).toBeVisible();
  });

  test('successful registration navigates to profile', async ({ page }) => {
    const email = uniqueEmail('success');
    await performRegister(page, email, TEST_PASSWORD);

    await page.waitForURL('**/profile');
    await expect(page).toHaveURL(/\/profile/);
  });

  test('duplicate email shows error', async ({ page }) => {
    const email = uniqueEmail('duplicate');

    // Register first time
    await performRegister(page, email, TEST_PASSWORD);
    await page.waitForURL('**/profile');

    // Register second time with same email
    await performRegister(page, email, TEST_PASSWORD);

    await expect(page.locator(registerPage.fieldError).first()).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });

  test('short password shows validation error', async ({ page }) => {
    await page.goto('/register');
    await page.locator(registerPage.emailInput).fill('test@example.com');
    await page.locator(registerPage.passwordInput).fill('short');
    await page.locator(registerPage.submitButton).click();

    await expect(page.locator(registerPage.fieldError).first()).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });

  test('login link navigates to login page', async ({ page }) => {
    await page.goto('/register');
    await page.locator(registerPage.loginLink).click();

    await page.waitForURL('**/login');
    await expect(page).toHaveURL(/\/login/);
  });
});
