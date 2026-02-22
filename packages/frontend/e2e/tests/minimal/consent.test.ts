import { E2E_TEST_CLIENT } from '@frontend-e2e/fixtures/index.js';
import { buildOAuthAuthorizeUrl } from '@frontend-e2e/helpers/consent.js';
import { loginAndGoToProfile } from '@frontend-e2e/helpers/profile-page.js';
import { registerUser } from '@frontend-e2e/helpers/register.js';
import { expect, test } from '@playwright/test';

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
    request,
    baseURL,
  }) => {
    const email = uniqueEmail('display');
    await registerUser(request, String(baseURL), email, TEST_PASSWORD);
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
    request,
    baseURL,
  }) => {
    const email = uniqueEmail('allow');
    await registerUser(request, String(baseURL), email, TEST_PASSWORD);
    await loginAndGoToProfile(page, email, TEST_PASSWORD);

    const authorizeUrl = buildOAuthAuthorizeUrl({
      state: 'test-allow-state',
    });
    await gotoConsentPage(page, authorizeUrl);

    // Wait for Allow button
    await expect(page.getByRole('button', { name: 'Allow' })).toBeVisible();

    // Click Allow
    await page.getByRole('button', { name: 'Allow' }).click();

    // Should redirect to the client redirect_uri with code and state
    await page.waitForURL((url) =>
      url.href.startsWith(E2E_TEST_CLIENT.redirectUri),
    );
    const url = new URL(page.url());
    expect(url.searchParams.get('code')).toBeTruthy();
    expect(url.searchParams.get('state')).toBe('test-allow-state');
  });

  test('deny consent redirects with error', async ({
    page,
    request,
    baseURL,
  }) => {
    const email = uniqueEmail('deny');
    await registerUser(request, String(baseURL), email, TEST_PASSWORD);
    await loginAndGoToProfile(page, email, TEST_PASSWORD);

    const authorizeUrl = buildOAuthAuthorizeUrl({
      state: 'test-deny-state',
    });
    await gotoConsentPage(page, authorizeUrl);

    // Wait for Deny button
    await expect(page.getByRole('button', { name: 'Deny' })).toBeVisible();

    // Click Deny
    await page.getByRole('button', { name: 'Deny' }).click();

    // Should redirect to the client redirect_uri with error
    await page.waitForURL((url) =>
      url.href.startsWith(E2E_TEST_CLIENT.redirectUri),
    );
    const url = new URL(page.url());
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
