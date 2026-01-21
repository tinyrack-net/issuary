import { expect, test } from '@playwright/test';
import { ROUTES } from '../../fixtures/test-data';
import { ensureLoggedOut } from '../../utils/auth-helpers';

test.describe('Passkey 2FA Verification Page', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedOut(page);
  });

  test('should display passkey verification page', async ({ page }) => {
    await page.goto(ROUTES.verifyPasskey);

    await expect(
      page.getByRole('heading', { name: /passkey verification/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/use your passkey to complete sign in/i),
    ).toBeVisible();
  });

  test('should show error when no pending 2FA session', async ({ page }) => {
    await page.goto(ROUTES.verifyPasskey);

    // Without a pending 2FA session, should show error message or retry button
    // The page auto-attempts verification on mount, then shows retry button
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible({
      timeout: 5000,
    });
  });

  test('should have retry button after failure', async ({ page }) => {
    await page.goto(ROUTES.verifyPasskey);

    // Wait for the initial attempt to fail
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible({
      timeout: 5000,
    });
  });

  test('should have back to login link', async ({ page }) => {
    await page.goto(ROUTES.verifyPasskey);

    await page.getByRole('link', { name: /back to login/i }).click();
    await expect(page).toHaveURL(ROUTES.login);
  });

  test('should preserve OAuth params when navigating back to login', async ({
    page,
  }) => {
    const oauthParams = new URLSearchParams({
      client_id: 'test-client',
      redirect_uri: 'http://localhost:3000/callback',
      response_type: 'code',
      scope: 'openid profile email',
      state: 'test-state',
    });

    await page.goto(`${ROUTES.verifyPasskey}?${oauthParams.toString()}`);

    await page.getByRole('link', { name: /back to login/i }).click();

    // Should preserve OAuth params in URL
    const url = new URL(page.url());
    expect(url.searchParams.get('client_id')).toBe('test-client');
    expect(url.searchParams.get('state')).toBe('test-state');
  });
});
