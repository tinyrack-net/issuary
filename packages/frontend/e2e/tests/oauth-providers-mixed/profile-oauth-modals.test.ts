import { expect } from '@playwright/test';
import { genericOAuth } from '@tinyrack/issuary-server/identity-providers/generic-oauth';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
import {
  modal,
  removePasswordModal,
  setPasswordModal,
  unlinkOAuthModal,
} from '#frontend-e2e/helpers/profile-page.ts';
import { getTestApiClient } from '#frontend-e2e/setup/api-client.ts';

const TEST_PASSWORD = 'test-password-123';

function oauthCase(providerId: string, displayName: string) {
  return {
    providerId,
    displayName,
    email: `oauth-${providerId}@allowed.test`,
  };
}

const OAUTH_CASES = {
  setPasswordSuccess: oauthCase(
    'profile-set-password-success',
    'Profile Set Password Success',
  ),
  setPasswordMismatch: oauthCase(
    'profile-set-password-mismatch',
    'Profile Set Password Mismatch',
  ),
  setPasswordShort: oauthCase(
    'profile-set-password-short',
    'Profile Set Password Short',
  ),
  setPasswordCancel: oauthCase(
    'profile-set-password-cancel',
    'Profile Set Password Cancel',
  ),
  removePasswordSuccess: oauthCase(
    'profile-remove-password-success',
    'Profile Remove Password Success',
  ),
  removePasswordWrong: oauthCase(
    'profile-remove-password-wrong',
    'Profile Remove Password Wrong',
  ),
  removePasswordCancel: oauthCase(
    'profile-remove-password-cancel',
    'Profile Remove Password Cancel',
  ),
  unlinkOpen: oauthCase('profile-unlink-open', 'Profile Unlink Open'),
  unlinkConfirm: oauthCase('profile-unlink-confirm', 'Profile Unlink Confirm'),
  unlinkCancel: oauthCase('profile-unlink-cancel', 'Profile Unlink Cancel'),
};

type OAuthCase = (typeof OAUTH_CASES)[keyof typeof OAUTH_CASES];

function createProfileOauthProviders(host: string) {
  return Object.values(OAUTH_CASES).map(({ providerId, displayName }) =>
    genericOAuth({
      id: providerId,
      enabled: true,
      display_name: displayName,
      icon_url: `https://example.com/${providerId}.svg`,
      client_id: `${providerId}-client-id`,
      client_secret: `${providerId}-client-secret`,
      authorization_url: `${host}/test/oauth-stub/${providerId}/authorize`,
      token_url: `${host}/test/oauth-stub/${providerId}/token`,
      userinfo_url: `${host}/test/oauth-stub/${providerId}/userinfo`,
      scopes: ['openid', 'profile', 'email'],
      email_conflict_strategy: 'auto_link',
      userinfo_mapping: {
        id: 'sub',
        email: 'email',
        email_verified: 'email_verified',
        name: 'name',
        picture: 'picture',
      },
    }),
  );
}

const test = createScenarioFixture((backendPort) => {
  const host = `http://localhost:${backendPort}`;

  return {
    ...E2E_BASE_CONFIG,
    ...createTestConfig(backendPort, {
      registration: {
        enabled: true,
        allowed_email_patterns: ['*@allowed.test'],
      },
    }),
    identity_providers: createProfileOauthProviders(host),
  };
});

/**
 * Logs in via the selected OAuth provider.
 * Returns to /profile after successful OAuth login.
 */
async function loginViaOAuthStub(
  page: import('@playwright/test').Page,
  oauth: OAuthCase,
): Promise<void> {
  await page.goto('/login');
  await page.getByRole('link', { name: oauth.displayName }).click();
  await page.waitForURL('**/profile');
}

test.describe('SetPasswordModal', () => {
  test('OAuth-only user sees Set Password button and can set password', async ({
    page,
  }) => {
    // Login via OAuth (creates an OAuth-only user with no password)
    await loginViaOAuthStub(page, OAUTH_CASES.setPasswordSuccess);

    // Should show "No password set" status
    await expect(page.getByText('No password set')).toBeVisible();

    // "Set Password" button should be visible
    await page.getByRole('button', { name: 'Set Password' }).click();

    // Modal should open
    await expect(page.locator(modal.openModal)).toBeVisible();

    // Fill in password fields
    await page
      .locator(setPasswordModal.newPassword)
      .fill('new-secure-password');
    await page
      .locator(setPasswordModal.confirmPassword)
      .fill('new-secure-password');

    // Submit
    await page.locator(setPasswordModal.submitButton).click();

    // Modal should close
    await expect(page.locator(modal.openModal)).not.toBeVisible();

    // Password status should update to "set"
    await expect(page.getByText('Password is set')).toBeVisible();
  });

  test('password mismatch shows validation error', async ({ page }) => {
    await loginViaOAuthStub(page, OAUTH_CASES.setPasswordMismatch);

    await page.getByRole('button', { name: 'Set Password' }).click();
    await expect(page.locator(modal.openModal)).toBeVisible();

    await page.locator(setPasswordModal.newPassword).fill('password-one');
    await page
      .locator(setPasswordModal.confirmPassword)
      .fill('password-different');

    await page.locator(setPasswordModal.submitButton).click();

    // Validation error should appear
    await expect(
      page.locator(setPasswordModal.fieldError).first(),
    ).toBeVisible();
  });

  test('short password shows validation error', async ({ page }) => {
    await loginViaOAuthStub(page, OAUTH_CASES.setPasswordShort);

    await page.getByRole('button', { name: 'Set Password' }).click();
    await expect(page.locator(modal.openModal)).toBeVisible();

    await page.locator(setPasswordModal.newPassword).fill('abc');
    await page.locator(setPasswordModal.confirmPassword).fill('abc');

    await page.locator(setPasswordModal.submitButton).click();

    await expect(
      page.locator(setPasswordModal.fieldError).first(),
    ).toBeVisible();
  });

  test('cancel closes modal without changes', async ({ page }) => {
    await loginViaOAuthStub(page, OAUTH_CASES.setPasswordCancel);

    await page.getByRole('button', { name: 'Set Password' }).click();
    await expect(page.locator(modal.openModal)).toBeVisible();

    await page.locator(setPasswordModal.cancelButton).click();

    await expect(page.locator(modal.openModal)).not.toBeVisible();
    await expect(page.getByText('No password set')).toBeVisible();
  });
});

test.describe('RemovePasswordModal', () => {
  /**
   * Sets up a user that has both a password and a linked OAuth account.
   *
   * 1. Register a user with the OAuth stub email + password (via API).
   * 2. Log out (clear session).
   * 3. Log in via OAuth stub (auto-links to existing user).
   * 4. Navigate to profile.
   */
  async function setupUserWithPasswordAndOAuth(
    page: import('@playwright/test').Page,
    baseURL: string,
    oauth: OAuthCase,
  ): Promise<void> {
    // Register a user with password using the same email as the stub.
    const client = getTestApiClient({ baseUrl: baseURL });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email: oauth.email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }

    // Login via OAuth stub - auto_link will link OAuth to existing user
    await loginViaOAuthStub(page, oauth);
  }

  test('user with password and OAuth can remove password', async ({
    page,
    baseURL,
  }) => {
    await setupUserWithPasswordAndOAuth(
      page,
      String(baseURL),
      OAUTH_CASES.removePasswordSuccess,
    );

    // Should show password is set
    await expect(page.getByText('Password is set')).toBeVisible();

    // "Remove Password" button should be visible (since OAuth is linked)
    await page.getByRole('button', { name: 'Remove Password' }).click();

    // Modal should open
    await expect(page.locator(modal.openModal)).toBeVisible();

    // Enter current password
    await page.locator(removePasswordModal.currentPassword).fill(TEST_PASSWORD);

    // Click Remove
    await page.locator(removePasswordModal.submitButton).click();

    // Modal should close
    await expect(page.locator(modal.openModal)).not.toBeVisible();

    // Password status should change to "No password set"
    await expect(page.getByText('No password set')).toBeVisible();
  });

  test('wrong current password shows error', async ({ page, baseURL }) => {
    await setupUserWithPasswordAndOAuth(
      page,
      String(baseURL),
      OAUTH_CASES.removePasswordWrong,
    );

    await page.getByRole('button', { name: 'Remove Password' }).click();
    await expect(page.locator(modal.openModal)).toBeVisible();

    await page
      .locator(removePasswordModal.currentPassword)
      .fill('wrong-password');

    await page.locator(removePasswordModal.submitButton).click();

    // Should show error
    await expect(
      page.locator(removePasswordModal.fieldError).first(),
    ).toBeVisible();
  });

  test('cancel closes modal without removing password', async ({
    page,
    baseURL,
  }) => {
    await setupUserWithPasswordAndOAuth(
      page,
      String(baseURL),
      OAUTH_CASES.removePasswordCancel,
    );

    await page.getByRole('button', { name: 'Remove Password' }).click();
    await expect(page.locator(modal.openModal)).toBeVisible();

    await page.locator(removePasswordModal.cancelButton).click();

    await expect(page.locator(modal.openModal)).not.toBeVisible();
    await expect(page.getByText('Password is set')).toBeVisible();
  });
});

test.describe('UnlinkOAuthModal', () => {
  /**
   * Sets up a user with both password and OAuth, then navigates to profile.
   */
  async function setupLinkedUser(
    page: import('@playwright/test').Page,
    baseURL: string,
    oauth: OAuthCase,
  ): Promise<void> {
    const client = getTestApiClient({ baseUrl: baseURL });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email: oauth.email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }
    await loginViaOAuthStub(page, oauth);
  }

  test('unlink button opens confirmation modal with provider name', async ({
    page,
    baseURL,
  }) => {
    const oauth = OAUTH_CASES.unlinkOpen;
    await setupLinkedUser(page, String(baseURL), oauth);

    // Find the Linked Accounts section
    await expect(
      page.getByRole('heading', { name: 'Linked Accounts' }),
    ).toBeVisible();

    // Stub Success should show as "Connected"
    await expect(page.getByText('Connected').first()).toBeVisible();

    // Click Unlink button next to Stub Success
    await page.getByRole('button', { name: 'Unlink' }).click();

    // Modal should open
    await expect(page.locator(modal.openModal)).toBeVisible();

    // Warning alert should be visible
    await expect(page.locator(unlinkOAuthModal.warningAlert)).toBeVisible();

    // Modal should mention the provider name in the description
    await expect(
      page.getByText(`You are about to unlink ${oauth.displayName}`),
    ).toBeVisible();
  });

  test('confirm unlink removes the linked account', async ({
    page,
    baseURL,
  }) => {
    await setupLinkedUser(page, String(baseURL), OAUTH_CASES.unlinkConfirm);

    await page.getByRole('button', { name: 'Unlink' }).click();
    await expect(page.locator(modal.openModal)).toBeVisible();

    // Click the Unlink confirmation button in the modal
    await page.locator(unlinkOAuthModal.unlinkButton).click();

    // Modal should close
    await expect(page.locator(modal.openModal)).not.toBeVisible();

    // Provider should now show as "Not connected"
    await expect(page.getByText('Not connected').first()).toBeVisible();
  });

  test('cancel closes modal without unlinking', async ({ page, baseURL }) => {
    await setupLinkedUser(page, String(baseURL), OAUTH_CASES.unlinkCancel);

    await page.getByRole('button', { name: 'Unlink' }).click();
    await expect(page.locator(modal.openModal)).toBeVisible();

    await page.locator(unlinkOAuthModal.cancelButton).click();

    await expect(page.locator(modal.openModal)).not.toBeVisible();

    // Provider should still show as "Connected"
    await expect(page.getByText('Connected').first()).toBeVisible();
  });
});
