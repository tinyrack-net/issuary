import { expect, type Page } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
  E2E_TEST_USER,
  E2E_TEST_USER_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
import { uniqueEmail as createUniqueEmail } from '#frontend-e2e/helpers/identity.ts';
import { loginPasswordPage } from '#frontend-e2e/helpers/login.ts';
import {
  changePasswordModal,
  loginAndGoToProfile,
  modal,
} from '#frontend-e2e/helpers/profile-page.ts';
import { getTestApiClient } from '#frontend-e2e/setup/api-client.ts';

const test = createScenarioFixture((backendPort) => ({
  ...E2E_BASE_CONFIG,
  ...createTestConfig(backendPort, {
    registration: {
      enabled: true,
      allowed_email_patterns: ['*'],
    },
  }),
  users: [E2E_TEST_USER_CONFIG],
}));

/**
 * Generates a unique test email for each test to avoid collisions.
 */
function uniqueEmail(suffix: string): string {
  return createUniqueEmail(test.info(), `profile-${suffix}`);
}

const TEST_PASSWORD = 'test-password-123';
const NEW_PASSWORD = 'new-password-456';

async function expectPasswordLoginRejected(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/login/password');
  await page.locator(loginPasswordPage.emailInput).fill(email);
  await page.locator(loginPasswordPage.passwordInput).fill(password);
  await page.locator(loginPasswordPage.submitButton).click();

  await expect(page.locator(loginPasswordPage.fieldError).first()).toHaveText(
    'Login failed. Please check your email and password.',
  );
  await expect(page).toHaveURL(/\/login\/password/);
}

async function expectPasswordLoginSucceeds(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/login/password');
  await page.locator(loginPasswordPage.emailInput).fill(email);
  await page.locator(loginPasswordPage.passwordInput).fill(password);
  await page.locator(loginPasswordPage.submitButton).click();
  await page.waitForURL('**/profile');
  await expect(page.getByText(email).first()).toBeVisible();
}

test.describe('Profile page', () => {
  test('displays user email and account info', async ({ page, baseURL }) => {
    const email = uniqueEmail('display');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }
    await loginAndGoToProfile(page, email, TEST_PASSWORD);

    // Verify user email is visible
    await expect(page.getByText(email).first()).toBeVisible();

    // Verify Account Information section
    await expect(page.getByText('Account Information')).toBeVisible();
  });

  test('shows security section with password status', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('security');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }
    await loginAndGoToProfile(page, email, TEST_PASSWORD);

    // Security section header should be visible
    await expect(page.getByRole('heading', { name: 'Security' })).toBeVisible();

    // Password section should show "Password is set"
    await expect(page.getByText('Password is set')).toBeVisible();
  });

  test('logout redirects to login', async ({ page }) => {
    await loginAndGoToProfile(
      page,
      E2E_TEST_USER.email,
      E2E_TEST_USER.password,
    );

    // Click logout button (has "Log out" text)
    await page.getByRole('button', { name: 'Log out' }).click();

    // Should redirect to login
    await page.waitForURL('**/login');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated access redirects to login', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForURL('**/login');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Change password', () => {
  test('successful password change updates subsequent login behavior', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('change-pw-ok');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }
    await loginAndGoToProfile(page, email, TEST_PASSWORD);

    // Click "Change Password" button
    await page.getByRole('button', { name: 'Change Password' }).click();

    // Modal should open
    await expect(page.locator(modal.openModal)).toBeVisible();

    // Fill in current and new passwords
    await page.locator(changePasswordModal.currentPassword).fill(TEST_PASSWORD);
    await page.locator(changePasswordModal.newPassword).fill(NEW_PASSWORD);
    await page.locator(changePasswordModal.confirmPassword).fill(NEW_PASSWORD);

    // Submit
    await page.locator(changePasswordModal.submitButton).click();

    // Modal should close
    await expect(page.locator(modal.openModal)).not.toBeVisible();

    await page.getByRole('button', { name: 'Log out' }).click();
    await page.waitForURL('**/login');

    await expectPasswordLoginRejected(page, email, TEST_PASSWORD);
    await expectPasswordLoginSucceeds(page, email, NEW_PASSWORD);
  });

  test('wrong current password shows error', async ({ page, baseURL }) => {
    const email = uniqueEmail('change-pw-err');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }
    await loginAndGoToProfile(page, email, TEST_PASSWORD);

    await page.getByRole('button', { name: 'Change Password' }).click();
    await expect(page.locator(modal.openModal)).toBeVisible();

    await page
      .locator(changePasswordModal.currentPassword)
      .fill('wrong-password');
    await page
      .locator(changePasswordModal.newPassword)
      .fill('new-password-456');
    await page
      .locator(changePasswordModal.confirmPassword)
      .fill('new-password-456');

    await page.locator(changePasswordModal.submitButton).click();

    // Error should be shown
    await expect(
      page.locator(changePasswordModal.fieldError).first(),
    ).toBeVisible();
  });

  test('password mismatch shows validation error', async ({
    page,
    baseURL,
  }) => {
    const email = uniqueEmail('change-pw-mismatch');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }
    await loginAndGoToProfile(page, email, TEST_PASSWORD);

    await page.getByRole('button', { name: 'Change Password' }).click();
    await expect(page.locator(modal.openModal)).toBeVisible();

    await page.locator(changePasswordModal.currentPassword).fill(TEST_PASSWORD);
    await page
      .locator(changePasswordModal.newPassword)
      .fill('new-password-456');
    await page
      .locator(changePasswordModal.confirmPassword)
      .fill('different-password');

    await page.locator(changePasswordModal.submitButton).click();

    // Validation error for mismatch
    await expect(
      page.locator(changePasswordModal.fieldError).first(),
    ).toBeVisible();
  });

  test('short password shows validation error', async ({ page, baseURL }) => {
    const email = uniqueEmail('change-pw-short');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }
    await loginAndGoToProfile(page, email, TEST_PASSWORD);

    await page.getByRole('button', { name: 'Change Password' }).click();
    await expect(page.locator(modal.openModal)).toBeVisible();

    await page.locator(changePasswordModal.currentPassword).fill(TEST_PASSWORD);
    await page.locator(changePasswordModal.newPassword).fill('abc');
    await page.locator(changePasswordModal.confirmPassword).fill('abc');

    await page.locator(changePasswordModal.submitButton).click();

    // Validation error for short password
    await expect(
      page.locator(changePasswordModal.fieldError).first(),
    ).toBeVisible();
  });
});
