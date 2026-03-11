import { expect } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.js';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
  E2E_TEST_USER,
  E2E_TEST_USER_CONFIG,
} from '#frontend-e2e/fixtures/index.js';
import { performLogin } from '#frontend-e2e/helpers/login.js';

const test = createScenarioFixture((backendPort) => ({
  ...E2E_BASE_CONFIG,
  ...createTestConfig(backendPort, {
    account_deletion: { enabled: true },
  }),
  users: [E2E_TEST_USER_CONFIG],
}));

test.describe('Config-managed profile constraints', () => {
  test('config-managed user sees restricted security and delete controls', async ({
    page,
  }) => {
    await performLogin(page, E2E_TEST_USER.email, E2E_TEST_USER.password);
    await page.waitForURL('**/profile');

    await expect(
      page.getByText(
        'This account is managed by configuration and the password cannot be changed',
      ),
    ).toBeVisible();

    await expect(
      page.getByRole('button', { name: 'Change Password' }),
    ).toHaveCount(0);
    await expect(page.getByText('Two-Factor Authentication')).toHaveCount(0);
    await expect(page.getByText('Passkeys')).toHaveCount(0);

    const deleteButton = page.getByRole('button', { name: 'Delete Account' });
    await expect(deleteButton).toBeVisible();
    await expect(deleteButton).toBeDisabled();

    await expect(
      page.getByText(
        'This account is managed by configuration and cannot be deleted',
      ),
    ).toBeVisible();
  });
});
