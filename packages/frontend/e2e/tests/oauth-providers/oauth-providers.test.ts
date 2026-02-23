import { E2E_TEST_USER } from '@frontend-e2e/fixtures/index.js';
import { expect, test } from '@frontend-e2e/fixtures/oauth-providers.js';
import { loginAndGoToProfile } from '@frontend-e2e/helpers/profile-page.js';

test.describe('OAuth providers UI', () => {
  test('login page renders configured oauth providers', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByText('GitHub')).toBeVisible();
    await expect(page.getByText('Google')).toBeVisible();
    await expect(page.getByText('GitHub Disabled')).toHaveCount(0);

    await expect(
      page.locator('a[href^="/api/oauth/github/authorize?mode=login"]'),
    ).toBeVisible();
    await expect(
      page.locator('a[href^="/api/oauth/google/authorize?mode=login"]'),
    ).toBeVisible();
    await expect(
      page.locator(
        'a[href^="/api/oauth/github-disabled/authorize?mode=login"]',
      ),
    ).toHaveCount(0);
  });

  test('profile shows linked accounts section for available providers', async ({
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
    await expect(page.getByText('GitHub')).toBeVisible();
    await expect(page.getByText('Google')).toBeVisible();
    await expect(page.getByText('GitHub Disabled')).toHaveCount(0);
  });

  test('provider callback error redirects to login with mapped message', async ({
    page,
  }) => {
    await page.goto(
      '/api/oauth/github/callback?error=access_denied&error_description=user_denied',
    );

    await page.waitForURL('**/login**');
    await expect(
      page.getByText('The authorization request was denied.'),
    ).toBeVisible();
  });

  test('callback without oauth session returns OAUTH_SESSION_EXPIRED', async ({
    request,
    baseURL,
  }) => {
    const callbackUrl = new URL(`${String(baseURL)}/api/oauth/github/callback`);
    callbackUrl.searchParams.set('code', 'github-code');
    callbackUrl.searchParams.set('state', 'missing-oauth-session');

    const response = await request.get(callbackUrl.toString(), {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'OAUTH_SESSION_EXPIRED',
    });
  });
});
