import { expect, test } from '@playwright/test';
import { TEST_PKCE } from '../../fixtures/test-data';
import { ensureLoggedOut, login } from '../../utils/auth-helpers';
import { buildAuthorizationUrl } from '../../utils/oauth-helpers';

test.describe('OAuth Authorization Flow', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedOut(page);
  });

  test('should show consent page after login for authenticated flow', async ({
    page,
  }) => {
    // 1. Login first
    await login(page);
    await page.waitForURL(/\/profile/);

    // 2. Navigate to authorization URL with prompt=consent to force consent page
    const authUrl = buildAuthorizationUrl({ prompt: 'consent' });
    await page.goto(authUrl);

    // 3. Should show consent page (forced via prompt=consent)
    await expect(
      page.getByRole('heading', { name: /authorization request/i }),
    ).toBeVisible();

    // 4. Verify allow and deny buttons are present
    await expect(page.getByRole('button', { name: /allow/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /deny/i })).toBeVisible();
  });

  test('should redirect to client after allow (integration test)', async ({
    page,
  }) => {
    // 1. Login first
    await login(page);
    await page.waitForURL(/\/profile/);

    // 2. Navigate to authorization URL with prompt=consent
    const authUrl = buildAuthorizationUrl({ prompt: 'consent' });
    await page.goto(authUrl);

    // 3. Click allow
    await page.getByRole('button', { name: /allow/i }).click();

    // 4. Should redirect to the client URL (localhost:3000)
    // The client may show error page if not properly configured,
    // but the redirect itself proves the flow worked
    await page.waitForURL(/localhost:3000/);
  });

  test('should redirect to client after deny (integration test)', async ({
    page,
  }) => {
    // 1. Login first
    await login(page);
    await page.waitForURL(/\/profile/);

    // 2. Navigate to authorization URL with prompt=consent
    const authUrl = buildAuthorizationUrl({ prompt: 'consent' });
    await page.goto(authUrl);

    // 3. Click deny
    await page.getByRole('button', { name: /deny/i }).click();

    // 4. Should redirect to the client URL with error
    await page.waitForURL(/localhost:3000/);
    // The URL should contain access_denied error
    expect(page.url()).toContain('error=access_denied');
  });

  test('should handle invalid client_id', async ({ page }) => {
    const authUrl = buildAuthorizationUrl({
      clientId: 'invalid-client-id',
    });
    await page.goto(authUrl);

    // Should show error or redirect to error page
    await expect(page.getByText(/invalid|error/i)).toBeVisible();
  });

  test('should handle invalid redirect_uri', async ({ page }) => {
    const authUrl = buildAuthorizationUrl({
      redirectUri: 'http://malicious.com/callback',
    });
    await page.goto(authUrl);

    // Should show error about invalid redirect URI
    await expect(page.getByText(/invalid|error|redirect/i)).toBeVisible();
  });

  test('should redirect unauthenticated user to login with OAuth params', async ({
    page,
  }) => {
    const authUrl = buildAuthorizationUrl({
      codeChallenge: TEST_PKCE.codeChallenge,
      codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
    });

    await page.goto(authUrl);

    // Should redirect to login page with OAuth params preserved
    await page.waitForURL(/\/login\?/);
    expect(page.url()).toContain('client_id=');
    expect(page.url()).toContain('redirect_uri=');
    expect(page.url()).toContain('code_challenge=');
  });
});

test.describe('OAuth Error Handling', () => {
  test('should display error page for missing required params', async ({
    page,
  }) => {
    // Navigate without client_id
    await page.goto('/application/oauth/authorize?response_type=code');

    // Should show error
    await expect(page.getByText(/error|invalid|missing/i)).toBeVisible();
  });

  test('should display error page for unsupported response_type', async ({
    page,
  }) => {
    const authUrl = buildAuthorizationUrl();
    const url = new URL(authUrl, 'http://localhost:8081');
    url.searchParams.set('response_type', 'token'); // Implicit flow not supported
    await page.goto(url.pathname + url.search);

    // Should show error about unsupported response type - use first() to avoid strict mode
    await expect(
      page.getByRole('heading', { name: /error/i }).first(),
    ).toBeVisible();
  });
});
