import { expect, test } from '@playwright/test';
import { ROUTES } from '../../fixtures/test-data';
import { ensureLoggedOut } from '../../utils/auth-helpers';

test.describe('2FA Method Selection Page', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedOut(page);
  });

  test('should display 2FA method selection page', async ({ page }) => {
    await page.goto(ROUTES.verify2fa);

    await expect(
      page.getByRole('heading', { name: /two-factor authentication/i }),
    ).toBeVisible();
    await expect(page.getByText(/choose a verification method/i)).toBeVisible();
  });

  test('should display TOTP option', async ({ page }) => {
    await page.goto(ROUTES.verify2fa);

    await expect(page.getByText(/authenticator app/i)).toBeVisible();
    await expect(
      page.getByText(/use a 6-digit code from your app/i),
    ).toBeVisible();
  });

  test('should display Passkey option', async ({ page }) => {
    await page.goto(ROUTES.verify2fa);

    await expect(page.getByText(/passkey/i)).toBeVisible();
    await expect(
      page.getByText(/use fingerprint, face, or security key/i),
    ).toBeVisible();
  });

  test('should navigate to TOTP verification when TOTP option clicked', async ({
    page,
  }) => {
    await page.goto(ROUTES.verify2fa);

    await page.getByRole('link', { name: /authenticator app/i }).click();
    await expect(page).toHaveURL(ROUTES.verifyTotp);
  });

  test('should navigate to Passkey verification when Passkey option clicked', async ({
    page,
  }) => {
    await page.goto(ROUTES.verify2fa);

    await page.getByRole('link', { name: /passkey/i }).click();
    await expect(page).toHaveURL(ROUTES.verifyPasskey);
  });

  test('should have back to login link', async ({ page }) => {
    await page.goto(ROUTES.verify2fa);

    await page.getByRole('link', { name: /back to login/i }).click();
    await expect(page).toHaveURL(ROUTES.login);
  });

  test('should preserve OAuth params when navigating to TOTP', async ({
    page,
  }) => {
    const oauthParams = new URLSearchParams({
      client_id: 'test-client',
      redirect_uri: 'http://localhost:3000/callback',
      response_type: 'code',
      scope: 'openid profile email',
      state: 'test-state',
    });

    await page.goto(`${ROUTES.verify2fa}?${oauthParams.toString()}`);

    await page.getByRole('link', { name: /authenticator app/i }).click();

    // Should preserve OAuth params in URL
    const url = new URL(page.url());
    expect(url.pathname).toBe(ROUTES.verifyTotp);
    expect(url.searchParams.get('client_id')).toBe('test-client');
    expect(url.searchParams.get('state')).toBe('test-state');
  });

  test('should preserve OAuth params when navigating to Passkey', async ({
    page,
  }) => {
    const oauthParams = new URLSearchParams({
      client_id: 'test-client',
      redirect_uri: 'http://localhost:3000/callback',
      response_type: 'code',
      scope: 'openid profile email',
      state: 'test-state',
    });

    await page.goto(`${ROUTES.verify2fa}?${oauthParams.toString()}`);

    await page.getByRole('link', { name: /passkey/i }).click();

    // Should preserve OAuth params in URL
    const url = new URL(page.url());
    expect(url.pathname).toBe(ROUTES.verifyPasskey);
    expect(url.searchParams.get('client_id')).toBe('test-client');
    expect(url.searchParams.get('state')).toBe('test-state');
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

    await page.goto(`${ROUTES.verify2fa}?${oauthParams.toString()}`);

    await page.getByRole('link', { name: /back to login/i }).click();

    // Should preserve OAuth params in URL
    const url = new URL(page.url());
    expect(url.pathname).toBe(ROUTES.login);
    expect(url.searchParams.get('client_id')).toBe('test-client');
    expect(url.searchParams.get('state')).toBe('test-state');
  });
});
