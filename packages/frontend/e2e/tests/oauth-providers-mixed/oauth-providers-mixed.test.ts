import { E2E_TEST_USER } from '@frontend-e2e/fixtures/index.js';
import { expect, test } from '@frontend-e2e/fixtures/oauth-providers-mixed.js';
import {
  expectOAuthError,
  startOAuthLogin,
} from '@frontend-e2e/helpers/oauth.js';
import { loginAndGoToProfile } from '@frontend-e2e/helpers/profile-page.js';

test.describe('OAuth providers mixed configuration', () => {
  test('login page shows only enabled providers', async ({ page }) => {
    await page.goto('/login');

    await expect(
      page.getByRole('link', { name: 'Stub Success' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Stub Denied' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Stub Not Allowed' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Stub Disabled' })).toHaveCount(
      0,
    );
  });

  test('provider deny callback shows OAuth access denied message', async ({
    page,
  }) => {
    await page.goto('/login');
    await startOAuthLogin(page, 'Stub Denied');

    await expectOAuthError(page, 'The authorization request was denied.');
  });

  test('email allowlist rejection maps to OAuth registration error', async ({
    page,
  }) => {
    await page.goto('/login');
    await startOAuthLogin(page, 'Stub Not Allowed');

    await expectOAuthError(
      page,
      'This email address is not allowed for registration.',
    );
  });

  test('successful provider callback logs user in and lands on profile', async ({
    page,
  }) => {
    await page.goto('/login');
    await startOAuthLogin(page, 'Stub Success');

    await page.waitForURL('**/profile');
    await expect(page).toHaveURL(/\/profile/);
    await expect(
      page.getByText('oauth-stub-success@allowed.test').first(),
    ).toBeVisible();
  });

  test('profile linked accounts only list enabled providers', async ({
    page,
  }) => {
    await loginAndGoToProfile(
      page,
      E2E_TEST_USER.email,
      E2E_TEST_USER.password,
    );

    await expect(
      page.getByRole('heading', { name: 'Linked Accounts' }),
    ).toBeVisible();
    await expect(page.getByText('Stub Success')).toBeVisible();
    await expect(page.getByText('Stub Denied')).toBeVisible();
    await expect(page.getByText('Stub Not Allowed')).toBeVisible();
    await expect(page.getByText('Stub Disabled')).toHaveCount(0);
  });
});
