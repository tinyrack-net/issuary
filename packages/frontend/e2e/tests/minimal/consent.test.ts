import { E2E_TEST_CLIENT } from '#frontend-e2e/fixtures/index.js';
import { expect, test } from '#frontend-e2e/fixtures/minimal.js';
import { buildOAuthAuthorizeUrl } from '#frontend-e2e/helpers/consent.js';
import { loginAndGoToProfile } from '#frontend-e2e/helpers/profile-page.js';
import { getTestApiClient } from '#frontend-e2e/setup/api-client.js';

/**
 * Generates a unique test email for each test to avoid session conflicts.
 */
function uniqueEmail(suffix: string): string {
  const ts = Date.now();
  return `consent-${suffix}-${ts}@example.com`;
}

const TEST_PASSWORD = 'test-password-123';

/**
 * Navigates to the OAuth authorize endpoint and waits for the consent
 * page to fully load. Retries navigation once if the page shows an error.
 */
async function gotoConsentPage(
  page: import('@playwright/test').Page,
  authorizeUrl: string,
): Promise<void> {
  await page.goto(authorizeUrl, { waitUntil: 'networkidle' });

  // If the consent page didn't load (e.g. under heavy parallel load),
  // retry the navigation once.
  const hasConsentContent = await page
    .getByRole('button', { name: 'Allow' })
    .isVisible()
    .catch(() => false);
  if (!hasConsentContent) {
    await page.goto(authorizeUrl, { waitUntil: 'networkidle' });
  }
}

test.describe('OAuth consent flow', () => {
  test('consent page shows client name, scopes, and user email', async ({
    page,
    baseURL,
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
    await gotoConsentPage(page, authorizeUrl);

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
    await gotoConsentPage(page, authorizeUrl);

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

  test('deny consent redirects with error', async ({ page, baseURL }) => {
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
    await gotoConsentPage(page, authorizeUrl);

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

  test('unauthenticated consent redirects to login', async ({ page }) => {
    const authorizeUrl = buildOAuthAuthorizeUrl();
    await page.goto(authorizeUrl, { waitUntil: 'networkidle' });

    // Should redirect to login
    await page.waitForURL('**/login**');
    await expect(page).toHaveURL(/\/login/);
  });
});
