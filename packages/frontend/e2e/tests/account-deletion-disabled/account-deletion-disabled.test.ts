import { expect } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
  E2E_TEST_USER,
  E2E_TEST_USER_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
import { loginAndGoToProfile } from '#frontend-e2e/helpers/profile-page.ts';

const test = createScenarioFixture((backendPort) => ({
  ...E2E_BASE_CONFIG,
  ...createTestConfig(backendPort, {
    account_deletion: { enabled: false },
  }),
  users: [E2E_TEST_USER_CONFIG],
}));

test.describe('Account deletion disabled configuration', () => {
  test('profile hides delete account entry points', async ({ page }) => {
    await loginAndGoToProfile(
      page,
      E2E_TEST_USER.email,
      E2E_TEST_USER.password,
    );

    await expect(
      page.getByRole('heading', { name: 'Danger Zone' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Delete Account' }),
    ).toHaveCount(0);
  });
});
