import { expect, test } from '@playwright/test';
import { ROUTES } from '../../fixtures/test-data';
import { ensureLoggedOut } from '../../utils/auth-helpers';

test.describe('2FA Setup Method Selection Page', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedOut(page);
  });

  test('should display 2FA setup method selection page', async ({ page }) => {
    await page.goto(ROUTES.setup2fa);

    await expect(
      page.getByRole('heading', { name: /set up two-factor authentication/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/choose your preferred 2fa method/i),
    ).toBeVisible();
  });

  test('should display TOTP setup option', async ({ page }) => {
    await page.goto(ROUTES.setup2fa);

    await expect(page.getByText(/authenticator app/i)).toBeVisible();
    await expect(
      page.getByText(/use google authenticator, authy, etc/i),
    ).toBeVisible();
  });

  test('should display Passkey setup option', async ({ page }) => {
    await page.goto(ROUTES.setup2fa);

    await expect(page.getByText('Passkey')).toBeVisible();
    await expect(
      page.getByText(/use fingerprint, face, or security key/i),
    ).toBeVisible();
  });

  test('should navigate to TOTP setup when TOTP option clicked', async ({
    page,
  }) => {
    await page.goto(ROUTES.setup2fa);

    await page.getByRole('link', { name: /authenticator app/i }).click();
    await expect(page).toHaveURL(ROUTES.setupTotp);
  });

  test('should navigate to Passkey setup when Passkey option clicked', async ({
    page,
  }) => {
    await page.goto(ROUTES.setup2fa);

    await page.getByRole('link', { name: /passkey/i }).click();
    await expect(page).toHaveURL(ROUTES.setupPasskey);
  });

  test('should have back to login link', async ({ page }) => {
    await page.goto(ROUTES.setup2fa);

    await page.getByRole('link', { name: /back to login/i }).click();
    await expect(page).toHaveURL(ROUTES.login);
  });

  test('should preserve OAuth params when navigating to TOTP setup', async ({
    page,
  }) => {
    const oauthParams = new URLSearchParams({
      client_id: 'test-client',
      redirect_uri: 'http://localhost:3000/callback',
      response_type: 'code',
      scope: 'openid profile email',
      state: 'test-state',
    });

    await page.goto(`${ROUTES.setup2fa}?${oauthParams.toString()}`);

    await page.getByRole('link', { name: /authenticator app/i }).click();

    // Should preserve OAuth params in URL
    const url = new URL(page.url());
    expect(url.pathname).toBe(ROUTES.setupTotp);
    expect(url.searchParams.get('client_id')).toBe('test-client');
    expect(url.searchParams.get('state')).toBe('test-state');
  });

  test('should preserve OAuth params when navigating to Passkey setup', async ({
    page,
  }) => {
    const oauthParams = new URLSearchParams({
      client_id: 'test-client',
      redirect_uri: 'http://localhost:3000/callback',
      response_type: 'code',
      scope: 'openid profile email',
      state: 'test-state',
    });

    await page.goto(`${ROUTES.setup2fa}?${oauthParams.toString()}`);

    await page.getByRole('link', { name: /passkey/i }).click();

    // Should preserve OAuth params in URL
    const url = new URL(page.url());
    expect(url.pathname).toBe(ROUTES.setupPasskey);
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

    await page.goto(`${ROUTES.setup2fa}?${oauthParams.toString()}`);

    await page.getByRole('link', { name: /back to login/i }).click();

    // Should preserve OAuth params in URL
    const url = new URL(page.url());
    expect(url.pathname).toBe(ROUTES.login);
    expect(url.searchParams.get('client_id')).toBe('test-client');
    expect(url.searchParams.get('state')).toBe('test-state');
  });

  test('should only show TOTP option when methods param contains only totp', async ({
    page,
  }) => {
    await page.goto(`${ROUTES.setup2fa}?methods=totp`);

    await expect(page.getByText(/authenticator app/i)).toBeVisible();
    // Passkey option should not be visible
    await expect(
      page.getByRole('link', { name: /passkey/i }),
    ).not.toBeVisible();
  });

  test('should only show Passkey option when methods param contains only passkey', async ({
    page,
  }) => {
    await page.goto(`${ROUTES.setup2fa}?methods=passkey`);

    await expect(page.getByText(/passkey/i)).toBeVisible();
    // TOTP option should not be visible
    await expect(
      page.getByRole('link', { name: /authenticator app/i }),
    ).not.toBeVisible();
  });

  test('should show both options when methods param contains totp and passkey', async ({
    page,
  }) => {
    await page.goto(`${ROUTES.setup2fa}?methods=totp,passkey`);

    await expect(page.getByText(/authenticator app/i)).toBeVisible();
    await expect(page.getByText(/passkey/i)).toBeVisible();
  });
});
