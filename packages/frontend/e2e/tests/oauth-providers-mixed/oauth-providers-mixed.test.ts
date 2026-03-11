import { expect } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.js';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
  E2E_TEST_USER,
  E2E_TEST_USER_CONFIG,
} from '#frontend-e2e/fixtures/index.js';
import { createMixedOauthProviders } from '#frontend-e2e/fragments/oauth-providers.js';
import {
  expectOAuthError,
  startOAuthLogin,
} from '#frontend-e2e/helpers/oauth.js';
import { loginAndGoToProfile } from '#frontend-e2e/helpers/profile-page.js';

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
    users: [E2E_TEST_USER_CONFIG],
    identity_providers: createMixedOauthProviders(host),
  };
});

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

  test('temporarily unavailable oauth error is mapped to UI message', async ({
    page,
  }) => {
    await page.goto('/login?oauth_error=temporarily_unavailable');
    await expectOAuthError(
      page,
      'The service is temporarily unavailable. Please try again later.',
    );
  });

  test('server oauth error is mapped to UI message', async ({ page }) => {
    await page.goto('/login?oauth_error=server_error');
    await expectOAuthError(
      page,
      'An error occurred on the authentication server. Please try again later.',
    );
  });

  test('unknown oauth error falls back to generic message', async ({
    page,
  }) => {
    await page.goto('/login?oauth_error=unknown_oauth_error');
    await expectOAuthError(page, 'OAuth login failed. Please try again.');
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

  test('callback without oauth session returns OAUTH_SESSION_EXPIRED', async ({
    request,
    baseURL,
  }) => {
    const callbackUrl = new URL(
      `${String(baseURL)}/api/oauth/stub-success/callback`,
    );
    callbackUrl.searchParams.set('code', 'stub-success-code');
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
