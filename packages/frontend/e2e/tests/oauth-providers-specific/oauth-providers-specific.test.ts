import { E2E_TEST_USER } from '@frontend-e2e/fixtures/index.js';
import {
  expect,
  test,
} from '@frontend-e2e/fixtures/oauth-providers-specific.js';
import { startOAuthLogin } from '@frontend-e2e/helpers/oauth.js';
import { loginAndGoToProfile } from '@frontend-e2e/helpers/profile-page.js';
import { getTestApiClient } from '@frontend-e2e/setup/api-client.js';

test.describe('Provider-specific OAuth flows', () => {
  test('login page shows all three provider stubs', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('link', { name: 'GitHub Stub' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Apple Stub' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Google Stub' })).toBeVisible();
  });

  test('GitHub stub login with numeric id and avatar_url mapping', async ({
    page,
  }) => {
    await page.goto('/login');
    await startOAuthLogin(page, 'GitHub Stub');

    await page.waitForURL('**/profile');
    await expect(page).toHaveURL(/\/profile/);
    await expect(
      page.getByText('oauth-github-stub@allowed.test').first(),
    ).toBeVisible();
  });

  test('Apple stub login via form_post callback with ID token', async ({
    page,
  }) => {
    await page.goto('/login');
    await startOAuthLogin(page, 'Apple Stub');

    await page.waitForURL('**/profile');
    await expect(page).toHaveURL(/\/profile/);
    await expect(
      page.getByText('oauth-apple-stub@allowed.test').first(),
    ).toBeVisible();
  });

  test('Google stub login with standard OIDC flow', async ({ page }) => {
    await page.goto('/login');
    await startOAuthLogin(page, 'Google Stub');

    await page.waitForURL('**/profile');
    await expect(page).toHaveURL(/\/profile/);
    await expect(
      page.getByText('oauth-google-stub@allowed.test').first(),
    ).toBeVisible();
  });

  test('profile shows linked accounts for all providers', async ({ page }) => {
    await loginAndGoToProfile(
      page,
      E2E_TEST_USER.email,
      E2E_TEST_USER.password,
    );

    await expect(
      page.getByRole('heading', { name: 'Linked Accounts' }),
    ).toBeVisible();
    await expect(page.getByText('GitHub Stub')).toBeVisible();
    await expect(page.getByText('Apple Stub')).toBeVisible();
    await expect(page.getByText('Google Stub')).toBeVisible();
  });

  test('link multiple providers to password-registered account', async ({
    page,
    baseURL,
  }) => {
    // Register a user with the same email as github-stub
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: {
        email: 'oauth-github-stub@allowed.test',
        password: 'test-password-123',
      },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }

    // Login via GitHub stub (auto-links to the existing user)
    await page.goto('/login');
    await startOAuthLogin(page, 'GitHub Stub');
    await page.waitForURL('**/profile');

    // GitHub Stub should show as connected
    await expect(page.getByText('Connected').first()).toBeVisible();

    // Link Google Stub via its authorize link
    await page.locator('a[href*="google-stub/authorize?mode=link"]').click();
    await page.waitForURL('**/profile');

    // Both should now be linked
    const connectedBadges = page.getByText('Connected');
    await expect(connectedBadges.first()).toBeVisible();
    await expect(connectedBadges.nth(1)).toBeVisible();
  });
});
