import { expect, test } from '@frontend-e2e/fixtures/passkey-optional.js';
import {
  loginAndGoToProfile,
  managePasskeysModal,
  modal,
  setupPasskeyModal,
} from '@frontend-e2e/helpers/profile-page.js';
import { registerUser } from '@frontend-e2e/helpers/register.js';
import { enableVirtualAuthenticator } from '@frontend-e2e/helpers/webauthn.js';

function uniqueEmail(suffix: string): string {
  const ts = Date.now();
  return `passkey-modal-${suffix}-${ts}@example.com`;
}

const TEST_PASSWORD = 'test-password-123';

test.describe('SetupPasskeyModal (profile)', () => {
  test('Add Passkey button opens modal with name input', async ({
    page,
    request,
    baseURL,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Virtual WebAuthn requires Chromium');

    const email = uniqueEmail('setup-open');
    await registerUser(request, String(baseURL), email, TEST_PASSWORD);
    await loginAndGoToProfile(page, email, TEST_PASSWORD);

    // Should show "No passkeys registered"
    await expect(page.getByText('No passkeys registered')).toBeVisible();

    // Click "Add Passkey" button
    await page.getByRole('button', { name: 'Add Passkey' }).click();

    // Modal should open
    await expect(page.locator(modal.openModal)).toBeVisible();

    // Name input should be visible
    await expect(page.locator(setupPasskeyModal.nameInput)).toBeVisible();

    // Description text should be visible
    await expect(
      page.getByText('A passkey lets you sign in securely'),
    ).toBeVisible();
  });

  test('complete passkey registration flow from profile modal', async ({
    page,
    request,
    baseURL,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Virtual WebAuthn requires Chromium');

    const virtualAuth = await enableVirtualAuthenticator(page);
    try {
      const email = uniqueEmail('setup-complete');
      await registerUser(request, String(baseURL), email, TEST_PASSWORD);
      await loginAndGoToProfile(page, email, TEST_PASSWORD);

      // Click "Add Passkey"
      await page.getByRole('button', { name: 'Add Passkey' }).click();
      await expect(page.locator(modal.openModal)).toBeVisible();

      // Enter a name for the passkey
      await page.locator(setupPasskeyModal.nameInput).fill('My Test Passkey');

      // Click Continue to trigger WebAuthn registration
      await page.locator(setupPasskeyModal.continueButton).click();

      // The virtual authenticator will automatically handle the prompt
      // Modal should close after successful registration
      await expect(page.locator(modal.openModal)).not.toBeVisible();

      // Profile should show passkey count
      await expect(page.getByText('1 passkey(s) registered')).toBeVisible();

      // "Manage" button should now be visible
      await expect(page.getByRole('button', { name: 'Manage' })).toBeVisible();
    } finally {
      await virtualAuth.teardown();
    }
  });

  test('cancel closes modal without adding passkey', async ({
    page,
    request,
    baseURL,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Virtual WebAuthn requires Chromium');

    const email = uniqueEmail('setup-cancel');
    await registerUser(request, String(baseURL), email, TEST_PASSWORD);
    await loginAndGoToProfile(page, email, TEST_PASSWORD);

    await page.getByRole('button', { name: 'Add Passkey' }).click();
    await expect(page.locator(modal.openModal)).toBeVisible();

    // Click Cancel
    await page.locator(setupPasskeyModal.cancelButton).click();

    // Modal should close
    await expect(page.locator(modal.openModal)).not.toBeVisible();

    // Still no passkeys
    await expect(page.getByText('No passkeys registered')).toBeVisible();
  });
});

test.describe('ManagePasskeysModal (profile)', () => {
  /**
   * Registers a passkey for a user programmatically via the
   * /setup/passkey URL, then navigates back to profile.
   */
  async function setupPasskeyForUser(
    page: import('@playwright/test').Page,
    email: string,
    password: string,
    request: import('@playwright/test').APIRequestContext,
    baseURL: string,
  ): Promise<void> {
    await registerUser(request, baseURL, email, password);
    await loginAndGoToProfile(page, email, password);

    // Use the direct URL to register passkey (like the existing test)
    await page.goto('/setup/passkey?passkey_name=Test+Passkey');
    await page.waitForURL('**/profile');
  }

  test('Manage button opens modal listing passkeys', async ({
    page,
    request,
    baseURL,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Virtual WebAuthn requires Chromium');

    const virtualAuth = await enableVirtualAuthenticator(page);
    try {
      const email = uniqueEmail('manage-list');
      await setupPasskeyForUser(
        page,
        email,
        TEST_PASSWORD,
        request,
        String(baseURL),
      );

      // Click "Manage" button
      await page.getByRole('button', { name: 'Manage' }).click();

      // Modal should open
      await expect(page.locator(modal.openModal)).toBeVisible();

      // Should show the passkey item
      await expect(
        page.locator(managePasskeysModal.passkeyItem).first(),
      ).toBeVisible();

      // Passkey name should be visible
      await expect(page.getByText('Test Passkey').first()).toBeVisible();

      // Close and Add New buttons should be visible
      await expect(page.locator(managePasskeysModal.closeButton)).toBeVisible();
      await expect(
        page.locator(managePasskeysModal.addNewButton),
      ).toBeVisible();
    } finally {
      await virtualAuth.teardown();
    }
  });

  test('rename passkey via inline edit', async ({
    page,
    request,
    baseURL,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Virtual WebAuthn requires Chromium');

    const virtualAuth = await enableVirtualAuthenticator(page);
    try {
      const email = uniqueEmail('manage-rename');
      await setupPasskeyForUser(
        page,
        email,
        TEST_PASSWORD,
        request,
        String(baseURL),
      );

      await page.getByRole('button', { name: 'Manage' }).click();
      await expect(page.locator(modal.openModal)).toBeVisible();

      // Click rename button (pencil icon)
      await page.getByRole('button', { name: 'Rename' }).first().click();

      // Edit form should appear with input
      const nameInput = page
        .locator('dialog.modal-open input[type="text"]')
        .first();
      await expect(nameInput).toBeVisible();

      // Clear and type new name
      await nameInput.clear();
      await nameInput.fill('Renamed Passkey');

      // Click Save
      await page.getByRole('button', { name: 'Save' }).first().click();

      // Should show the new name
      await expect(page.getByText('Renamed Passkey').first()).toBeVisible();
    } finally {
      await virtualAuth.teardown();
    }
  });

  test('delete passkey with inline confirmation', async ({
    page,
    request,
    baseURL,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Virtual WebAuthn requires Chromium');

    const virtualAuth = await enableVirtualAuthenticator(page);
    try {
      const email = uniqueEmail('manage-delete');
      await setupPasskeyForUser(
        page,
        email,
        TEST_PASSWORD,
        request,
        String(baseURL),
      );

      await page.getByRole('button', { name: 'Manage' }).click();
      await expect(page.locator(modal.openModal)).toBeVisible();

      // Click delete button (trash icon)
      await page.getByRole('button', { name: 'Delete' }).first().click();

      // Should show confirmation text
      await expect(page.getByText('Delete this passkey?')).toBeVisible();

      // Click Delete to confirm
      await page.getByRole('button', { name: 'Delete' }).first().click();

      // Passkey should be removed - show empty state
      await expect(page.locator(managePasskeysModal.emptyState)).toBeVisible();
    } finally {
      await virtualAuth.teardown();
    }
  });

  test('Add New Passkey button transitions to setup modal', async ({
    page,
    request,
    baseURL,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Virtual WebAuthn requires Chromium');

    const virtualAuth = await enableVirtualAuthenticator(page);
    try {
      const email = uniqueEmail('manage-add-new');
      await setupPasskeyForUser(
        page,
        email,
        TEST_PASSWORD,
        request,
        String(baseURL),
      );

      await page.getByRole('button', { name: 'Manage' }).click();
      await expect(page.locator(modal.openModal)).toBeVisible();

      // Click "Add New Passkey" button
      await page.locator(managePasskeysModal.addNewButton).click();

      // ManagePasskeys modal should close and SetupPasskey modal should open
      // The setup modal has the passkey name input
      await expect(page.locator(setupPasskeyModal.nameInput)).toBeVisible();

      // Title should change to "Add Passkey"
      await expect(page.getByText('Add Passkey')).toBeVisible();
    } finally {
      await virtualAuth.teardown();
    }
  });

  test('close button dismisses modal', async ({
    page,
    request,
    baseURL,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Virtual WebAuthn requires Chromium');

    const virtualAuth = await enableVirtualAuthenticator(page);
    try {
      const email = uniqueEmail('manage-close');
      await setupPasskeyForUser(
        page,
        email,
        TEST_PASSWORD,
        request,
        String(baseURL),
      );

      await page.getByRole('button', { name: 'Manage' }).click();
      await expect(page.locator(modal.openModal)).toBeVisible();

      await page.locator(managePasskeysModal.closeButton).click();

      await expect(page.locator(modal.openModal)).not.toBeVisible();

      // Passkey count should still be shown
      await expect(page.getByText('1 passkey(s) registered')).toBeVisible();
    } finally {
      await virtualAuth.teardown();
    }
  });
});
