import { expect } from '@playwright/test';
import { genericOAuth } from '@tinyrack/tinyauth-server/identity-providers/generic-oauth';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
  E2E_TEST_USER,
  E2E_TEST_USER_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
import { createSpecificOauthProviders } from '#frontend-e2e/fragments/oauth-providers.ts';
import { startOAuthLogin } from '#frontend-e2e/helpers/oauth.ts';
import { loginAndGoToProfile } from '#frontend-e2e/helpers/profile-page.ts';
import { getTestApiClient } from '#frontend-e2e/setup/api-client.ts';

function createProviderLinkOauthProviders(host: string) {
  return [
    genericOAuth({
      id: 'github-stub-link',
      enabled: true,
      display_name: 'GitHub Link Stub',
      icon_url: 'https://example.com/github-stub-link.svg',
      client_id: 'github-stub-link-client-id',
      client_secret: 'github-stub-link-client-secret',
      authorization_url: `${host}/test/oauth-stub/github-stub-link/authorize`,
      token_url: `${host}/test/oauth-stub/github-stub-link/token`,
      userinfo_url: `${host}/test/oauth-stub/github-stub-link/userinfo`,
      scopes: ['user:email'],
      email_conflict_strategy: 'auto_link',
      userinfo_mapping: {
        id: 'id',
        email: 'email',
        email_verified: 'email_verified',
        name: 'name',
        picture: 'avatar_url',
      },
    }),
    genericOAuth({
      id: 'google-stub-link',
      enabled: true,
      display_name: 'Google Link Stub',
      icon_url: 'https://example.com/google-stub-link.svg',
      client_id: 'google-stub-link-client-id',
      client_secret: 'google-stub-link-client-secret',
      authorization_url: `${host}/test/oauth-stub/google-stub-link/authorize`,
      token_url: `${host}/test/oauth-stub/google-stub-link/token`,
      userinfo_url: `${host}/test/oauth-stub/google-stub-link/userinfo`,
      scopes: ['openid', 'email', 'profile'],
      email_conflict_strategy: 'auto_link',
      userinfo_mapping: {
        id: 'sub',
        email: 'email',
        email_verified: 'email_verified',
        name: 'name',
        picture: 'picture',
      },
    }),
  ];
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
    users: [E2E_TEST_USER_CONFIG],
    identity_providers: [
      ...createSpecificOauthProviders(host),
      ...createProviderLinkOauthProviders(host),
    ],
  };
});

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

  test('Apple stub login via form_post callback', async ({ page }) => {
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
    // Register a user with the same email as the link-specific GitHub stub.
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: {
        email: 'oauth-github-stub-link@allowed.test',
        password: 'test-password-123',
      },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }

    // Login via GitHub stub (auto-links to the existing user)
    await page.goto('/login');
    await startOAuthLogin(page, 'GitHub Link Stub');
    await page.waitForURL('**/profile');

    // GitHub Stub should show as connected
    await expect(page.getByText('Connected').first()).toBeVisible();

    // Link Google Stub via its authorize link
    await page
      .locator('a[href*="google-stub-link/authorize?mode=link"]')
      .click();
    await page.waitForURL('**/profile');

    // Both should now be linked
    const connectedBadges = page.getByText('Connected');
    await expect(connectedBadges.first()).toBeVisible();
    await expect(connectedBadges.nth(1)).toBeVisible();
  });
});
