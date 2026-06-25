import { expect } from '@playwright/test';
import {
  createScenarioFixture,
  gotoWithFirefoxRetry,
} from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
  E2E_TEST_CLIENT,
  E2E_TEST_CLIENT_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
import { buildOAuthAuthorizeUrl } from '#frontend-e2e/helpers/consent.ts';
import { uniqueEmail as createUniqueEmail } from '#frontend-e2e/helpers/identity.ts';
import { loginAndGoToProfile } from '#frontend-e2e/helpers/profile-page.ts';
import { getTestApiClient } from '#frontend-e2e/setup/api-client.ts';

const test = createScenarioFixture((backendPort) => ({
  ...E2E_BASE_CONFIG,
  ...createTestConfig(backendPort, {
    registration: {
      enabled: true,
      allowed_email_patterns: ['*'],
    },
  }),
  clients: [E2E_TEST_CLIENT_CONFIG],
}));

/**
 * Generates a unique test email for each test to avoid session conflicts.
 */
function uniqueEmail(suffix: string): string {
  return createUniqueEmail(test.info(), `consent-${suffix}`);
}

const TEST_PASSWORD = 'test-password-123';

/**
 * Navigates to the OAuth authorize endpoint and waits for the consent
 * page to fully load. Retries navigation once if the page shows an error.
 */
async function gotoConsentPage(
  page: import('@playwright/test').Page,
  browserName: string,
  authorizeUrl: string,
): Promise<void> {
  await gotoWithFirefoxRetry(page, browserName, authorizeUrl);

  // If the consent page didn't load (e.g. under heavy parallel load),
  // retry the navigation once.
  const hasConsentContent = await page
    .getByRole('button', { name: 'Allow' })
    .isVisible()
    .catch(() => false);
  if (!hasConsentContent) {
    await gotoWithFirefoxRetry(page, browserName, authorizeUrl);
    await expect(page.getByRole('button', { name: 'Allow' })).toBeVisible();
  }
}

test.describe('OAuth consent flow', () => {
  test('consent page shows client name, scopes, and user email', async ({
    page,
    baseURL,
    browserName,
  }) => {
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

    // Navigate to OAuth authorize
    const authorizeUrl = buildOAuthAuthorizeUrl();
    await gotoConsentPage(page, browserName, authorizeUrl);

    // Should show consent page
    await expect(page.getByText('E2E Test App')).toBeVisible();

    // User email should be displayed
    await expect(page.getByText(email)).toBeVisible();

    // Scopes should be displayed
    await expect(
      page.getByText('Access your unique user identifier'),
    ).toBeVisible();

    // Allow and Deny buttons should be visible
    await expect(page.getByRole('button', { name: 'Allow' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Deny' })).toBeVisible();
  });

  test('allow consent redirects with authorization code', async ({
    page,
    baseURL,
    browserName,
  }) => {
    const email = uniqueEmail('allow');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }
    await loginAndGoToProfile(page, email, TEST_PASSWORD);

    const authorizeUrl = buildOAuthAuthorizeUrl({
      state: 'test-allow-state',
    });
    await gotoConsentPage(page, browserName, authorizeUrl);

    // Wait for Allow button
    await expect(page.getByRole('button', { name: 'Allow' })).toBeVisible();

    // Capture the redirect request before clicking, since the redirect
    // target is a dummy client URL that nothing serves.
    const redirectPromise = page.waitForRequest((req) =>
      req.url().startsWith(E2E_TEST_CLIENT.redirectUri),
    );

    // Click Allow
    await page.getByRole('button', { name: 'Allow' }).click();

    const redirectRequest = await redirectPromise;
    const url = new URL(redirectRequest.url());
    expect(url.searchParams.get('code')).toBeTruthy();
    expect(url.searchParams.get('state')).toBe('test-allow-state');
  });

  test('deny consent redirects with error', async ({
    page,
    baseURL,
    browserName,
  }) => {
    const email = uniqueEmail('deny');
    const client = getTestApiClient({ baseUrl: String(baseURL) });
    const registerRes = await client.api.auth.register.$post({
      header: {},
      json: { email, password: TEST_PASSWORD },
    });
    if (!registerRes.ok) {
      throw new Error(`Failed to register user: ${registerRes.status}`);
    }
    await loginAndGoToProfile(page, email, TEST_PASSWORD);

    const authorizeUrl = buildOAuthAuthorizeUrl({
      state: 'test-deny-state',
    });
    await gotoConsentPage(page, browserName, authorizeUrl);

    // Wait for Deny button
    await expect(page.getByRole('button', { name: 'Deny' })).toBeVisible();

    // Capture the redirect request before clicking, since the redirect
    // target is a dummy client URL that nothing serves.
    const redirectPromise = page.waitForRequest((req) =>
      req.url().startsWith(E2E_TEST_CLIENT.redirectUri),
    );

    // Click Deny
    await page.getByRole('button', { name: 'Deny' }).click();

    const redirectRequest = await redirectPromise;
    const url = new URL(redirectRequest.url());
    expect(url.searchParams.get('error')).toBe('access_denied');
    expect(url.searchParams.get('state')).toBe('test-deny-state');
  });

  test('unauthenticated consent redirects to login', async ({
    page,
    browserName,
  }) => {
    const authorizeUrl = buildOAuthAuthorizeUrl();
    await gotoWithFirefoxRetry(page, browserName, authorizeUrl);

    // Should redirect to login
    await page.waitForURL('**/login**');
    await expect(page).toHaveURL(/\/login/);
  });
});
