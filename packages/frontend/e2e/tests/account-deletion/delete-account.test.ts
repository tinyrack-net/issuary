import { expect, test } from '@frontend-e2e/fixtures/account-deletion.js';
import { loginPasswordPage } from '@frontend-e2e/helpers/login.js';
import {
  deleteAccountModal,
  loginAndGoToProfile,
  modal,
} from '@frontend-e2e/helpers/profile-page.js';
import { getTestApiClient } from '@frontend-e2e/setup/api-client.js';

/**
 * Generates a unique test email for each test to avoid collisions.
 */
function uniqueEmail(suffix: string): string {
  const ts = Date.now();
  return `delete-acct-${suffix}-${ts}@example.com`;
}

const TEST_PASSWORD = 'test-password-123';

test.describe('Delete account flow', () => {
  test('delete account button is visible', async ({ page, baseURL }) => {
    const email = uniqueEmail('visible');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }
    await loginAndGoToProfile(page, email, TEST_PASSWORD);

    // "Delete Account" button should be visible
    await expect(
      page.getByRole('button', { name: 'Delete Account' }),
    ).toBeVisible();
  });

  test('successful account deletion redirects to login', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('success');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }
    await loginAndGoToProfile(page, email, TEST_PASSWORD);

    // Click delete button
    await page.getByRole('button', { name: 'Delete Account' }).click();

    // Modal should open
    await expect(page.locator(modal.openModal)).toBeVisible();

    // Type confirmation text
    await page.locator(deleteAccountModal.confirmInput).fill('delete');

    // Submit (click the delete button inside the modal)
    await page.locator(deleteAccountModal.submitButton).click();

    // Should redirect to login
    await page.waitForURL('**/login');
    await expect(page).toHaveURL(/\/login/);
  });

  test('wrong confirmation text shows validation error', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('wrong-confirm');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }
    await loginAndGoToProfile(page, email, TEST_PASSWORD);

    await page.getByRole('button', { name: 'Delete Account' }).click();
    await expect(page.locator(modal.openModal)).toBeVisible();

    // Type wrong confirmation text
    await page.locator(deleteAccountModal.confirmInput).fill('wrong');
    await page.locator(deleteAccountModal.submitButton).click();

    // Should show validation error
    await expect(
      page.locator(deleteAccountModal.fieldError).first(),
    ).toBeVisible();
  });

  test('delete modal shows retention period from config', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('retention');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }
    await loginAndGoToProfile(page, email, TEST_PASSWORD);

    await page.getByRole('button', { name: 'Delete Account' }).click();
    await expect(page.locator(modal.openModal)).toBeVisible();
    await expect(page.getByText(/after 30 days\./)).toBeVisible();
  });

  test('cannot login after account deletion', async ({ page, baseURL }) => {
    const email = uniqueEmail('no-login');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }
    await loginAndGoToProfile(page, email, TEST_PASSWORD);

    // Delete the account
    await page.getByRole('button', { name: 'Delete Account' }).click();
    await expect(page.locator(modal.openModal)).toBeVisible();
    await page.locator(deleteAccountModal.confirmInput).fill('delete');
    await page.locator(deleteAccountModal.submitButton).click();

    // Wait for redirect to login
    await page.waitForURL('**/login');

    // Try to login with the deleted account
    await page.goto('/login/password');
    await page.locator(loginPasswordPage.emailInput).fill(email);
    await page.locator(loginPasswordPage.passwordInput).fill(TEST_PASSWORD);
    await page.locator(loginPasswordPage.submitButton).click();

    // Should show error (user not found)
    await expect(
      page.locator(loginPasswordPage.fieldError).first(),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login\/password/);
  });
});
