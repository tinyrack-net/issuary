import { expect, test } from '@playwright/test';
import { TEST_USER } from '../../fixtures/test-data';
import { ensureLoggedOut, login } from '../../utils/auth-helpers';
import {
  buildAuthorizationUrl,
  navigateToConsent,
} from '../../utils/oauth-helpers';

test.describe('OAuth Consent Page', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedOut(page);
    // Must be logged in to see consent page
    await login(page);
    await page.waitForURL(/\/profile/);
  });

  test('should display consent page with required information', async ({
    page,
  }) => {
    await navigateToConsent(page);

    // Should show authorization request title
    await expect(
      page.getByRole('heading', { name: /authorization request/i }),
    ).toBeVisible();

    // Should show user info
    await expect(page.getByText(TEST_USER.email)).toBeVisible();

    // Should show permissions being requested
    await expect(
      page.getByText(/this application will be able to/i),
    ).toBeVisible();

    // Should show allow and deny buttons
    await expect(page.getByRole('button', { name: /allow/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /deny/i })).toBeVisible();
  });

  test('should display requested scopes', async ({ page }) => {
    await navigateToConsent(page);

    // Should show openid, profile, email scopes (based on i18n translations)
    await expect(page.getByText(/user identifier/i)).toBeVisible();
    await expect(page.getByText(/profile information/i)).toBeVisible();
    await expect(page.getByText(/email address/i)).toBeVisible();
  });

  test('should redirect to client URL on allow', async ({ page }) => {
    await navigateToConsent(page);

    // Click allow button
    await page.getByRole('button', { name: /allow/i }).click();

    // Should redirect to callback URL (client may process and redirect further)
    await page.waitForURL(/localhost:3000/);
  });

  test('should redirect to client URL with error on deny', async ({ page }) => {
    await navigateToConsent(page);

    // Click deny button
    await page.getByRole('button', { name: /deny/i }).click();

    // Should redirect to callback URL with error
    await page.waitForURL(/localhost:3000/);
    expect(page.url()).toContain('error=access_denied');
  });
});

test.describe('OAuth Consent - Unauthenticated', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await ensureLoggedOut(page);

    const authUrl = buildAuthorizationUrl();
    await page.goto(authUrl);

    // Should be redirected to login page with OAuth params preserved
    await page.waitForURL(/\/login\?/);
    expect(page.url()).toContain('client_id=');
    expect(page.url()).toContain('redirect_uri=');
  });
});
