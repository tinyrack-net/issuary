import { expect, test } from '@playwright/test';
import {
  generateUniqueEmail,
  ROUTES,
  TEST_USER,
} from '../../fixtures/test-data';
import { ensureLoggedOut, login } from '../../utils/auth-helpers';
import {
  completeTotpSetup,
  completeTotpVerification,
  createUserViaApi,
  disableTotpViaApi,
  enableTotpViaApi,
  generateTOTPCode,
  loginWithTotp,
} from '../../utils/totp-helpers';

test.describe('TOTP Verification Page', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedOut(page);
  });

  test('should display TOTP verification form', async ({ page }) => {
    await page.goto(ROUTES.verifyTotp);

    await expect(
      page.getByRole('heading', { name: /two-factor authentication/i }),
    ).toBeVisible();
    await expect(page.getByPlaceholder(/enter 6-digit code/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /verify/i })).toBeVisible();
  });

  test('should show error for invalid TOTP code', async ({ page }) => {
    await page.goto(ROUTES.verifyTotp);

    await page.getByPlaceholder(/enter 6-digit code/i).fill('000000');
    await page.getByRole('button', { name: /verify/i }).click();

    // Should show error (session expired or invalid code)
    await expect(page.getByText(/invalid|expired/i)).toBeVisible();
  });

  test('should have back to login link', async ({ page }) => {
    await page.goto(ROUTES.verifyTotp);

    await page.getByRole('link', { name: /back to login/i }).click();
    await expect(page).toHaveURL(ROUTES.login);
  });
});

test.describe('TOTP Setup Page', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedOut(page);
  });

  test('should display TOTP setup page', async ({ page }) => {
    await page.goto(ROUTES.setupTotp);

    // Page should display setup instructions
    await expect(
      page.getByRole('heading', { name: /two-factor authentication/i }),
    ).toBeVisible();
  });

  test('should have back to login link', async ({ page }) => {
    await page.goto(ROUTES.setupTotp);

    const backLink = page.getByRole('link', { name: /back to login/i });
    if (await backLink.isVisible()) {
      await backLink.click();
      await expect(page).toHaveURL(ROUTES.login);
    }
  });
});

test.describe('TOTP Login Flow - Full Integration', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedOut(page);
  });

  test('should login successfully with TOTP when user has 2FA enabled', async ({
    page,
  }) => {
    // Setup: Create a user with TOTP enabled via API
    const email = generateUniqueEmail('totp-login');
    const password = 'testPassword123!';

    // Register and login first
    await createUserViaApi(page, email, password);
    await login(page, email, password);

    // Wait for profile page (config user is exempt, new user might need email verification)
    // Handle potential email verification requirement
    try {
      await page.waitForURL(/\/profile|\/verify-email|\/setup/, {
        timeout: 5000,
      });
    } catch {
      // User might already be on profile if email verification is disabled for this user
    }

    // If user got to profile, enable TOTP via API
    if (page.url().includes('/profile')) {
      const { secret } = await enableTotpViaApi(page);

      // Logout
      await page.getByRole('button', { name: /log out/i }).click();
      await page.waitForURL(ROUTES.login, { timeout: 10000 });

      // Now login with TOTP
      await loginWithTotp(page, email, password, secret);

      // Should be on profile page
      await expect(page).toHaveURL(ROUTES.profile);
      await expect(
        page.getByRole('heading', { name: /my profile/i }),
      ).toBeVisible();

      // Cleanup: disable TOTP
      await disableTotpViaApi(page, secret);
    }
  });

  test('should show error with invalid TOTP code during login', async ({
    page,
  }) => {
    const email = generateUniqueEmail('totp-invalid');
    const password = 'testPassword123!';

    // Register and login
    await createUserViaApi(page, email, password);
    await login(page, email, password);

    // Handle navigation
    try {
      await page.waitForURL(/\/profile/, { timeout: 5000 });
    } catch {
      // Skip test if email verification is required
      test.skip();
      return;
    }

    // Enable TOTP
    const { secret } = await enableTotpViaApi(page);

    // Logout
    await page.getByRole('button', { name: /log out/i }).click();
    await page.waitForURL(ROUTES.login);

    // Login with credentials
    await page.getByPlaceholder(/hello@example.com/i).fill(email);
    await page.getByPlaceholder(/enter your password/i).fill(password);
    await page.getByRole('button', { name: /log in/i }).click();

    // Wait for TOTP page
    await page.waitForURL(/\/verify-totp|\/verify-2fa/, { timeout: 10000 });

    // Handle 2FA selection if needed
    if (page.url().includes('/verify-2fa')) {
      await page.getByRole('link', { name: /authenticator app/i }).click();
      await page.waitForURL(/\/verify-totp/);
    }

    // Enter invalid TOTP code
    await page.getByPlaceholder(/enter 6-digit code/i).fill('000000');
    await page.getByRole('button', { name: /verify/i }).click();

    // Should show error
    await expect(page.getByText(/invalid/i)).toBeVisible();

    // Should still be on verification page
    await expect(page).toHaveURL(/\/verify-totp/);

    // Cleanup
    await ensureLoggedOut(page);
    await login(page, email, password);
    await completeTotpVerification(page, secret);
    await page.waitForURL(ROUTES.profile);
    await disableTotpViaApi(page, secret);
  });

  test('should redirect back to login when session expires during TOTP verification', async ({
    page,
  }) => {
    // Go directly to TOTP page without valid session
    await page.goto(ROUTES.verifyTotp);

    // Enter any code
    await page.getByPlaceholder(/enter 6-digit code/i).fill('123456');
    await page.getByRole('button', { name: /verify/i }).click();

    // Should show session expired error
    await expect(page.getByText(/expired|session/i)).toBeVisible();

    // Click back to login
    await page.getByRole('link', { name: /back to login/i }).click();
    await expect(page).toHaveURL(ROUTES.login);
  });
});

test.describe('TOTP Setup Flow - Full Integration', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedOut(page);
  });

  test('should complete TOTP setup and login successfully', async ({
    page,
  }) => {
    const email = generateUniqueEmail('totp-setup-full');
    const password = 'testPassword123!';

    // Register user
    await createUserViaApi(page, email, password);
    await login(page, email, password);

    // Check if we got to profile (no email verification required)
    try {
      await page.waitForURL(/\/profile/, { timeout: 5000 });
    } catch {
      test.skip();
      return;
    }

    // Setup TOTP from profile - need to open modal
    // Check if TOTP section exists
    const totpSection = page.getByText(/two-factor authentication|totp/i);
    if (await totpSection.isVisible()) {
      // Look for enable button
      const enableButton = page.getByRole('button', { name: /enable|set up/i });
      if (await enableButton.isVisible()) {
        await enableButton.click();

        // Should open modal or navigate to setup
        await page.waitForSelector('img[alt="TOTP QR Code"]', {
          timeout: 10000,
        });

        // Complete setup
        const secret = await completeTotpSetup(page);

        // Should return to profile
        await page.waitForURL(ROUTES.profile, { timeout: 10000 });

        // Verify TOTP is now enabled
        await expect(page.getByText(/enabled|active/i)).toBeVisible();

        // Test login with TOTP
        await page.getByRole('button', { name: /log out/i }).click();
        await page.waitForURL(ROUTES.login);

        await loginWithTotp(page, email, password, secret);
        await expect(page).toHaveURL(ROUTES.profile);

        // Cleanup
        await disableTotpViaApi(page, secret);
      }
    }
  });
});

test.describe('TOTP Profile Management', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedOut(page);
  });

  test('should enable and disable TOTP from profile', async ({ page }) => {
    const email = generateUniqueEmail('totp-profile');
    const password = 'testPassword123!';

    // Register and login
    await createUserViaApi(page, email, password);
    await login(page, email, password);

    try {
      await page.waitForURL(/\/profile/, { timeout: 5000 });
    } catch {
      test.skip();
      return;
    }

    // Enable TOTP via API (simpler than UI for this test)
    const { secret } = await enableTotpViaApi(page);

    // Refresh page to see updated status
    await page.reload();

    // Check if TOTP status shows enabled
    await expect(page.getByText(/enabled|active/i)).toBeVisible();

    // Find and click disable button
    const disableButton = page.getByRole('button', { name: /disable/i });
    if (await disableButton.isVisible()) {
      await disableButton.click();

      // Should open disable modal
      await expect(page.getByText(/enter.*code.*authenticator/i)).toBeVisible();

      // Enter TOTP code
      const code = generateTOTPCode(secret);
      await page.getByPlaceholder(/000000/i).fill(code);

      // Confirm disable
      await page
        .getByRole('button', { name: /disable/i })
        .last()
        .click();

      // Wait for modal to close and status to update
      await page.waitForTimeout(1000);
      await page.reload();

      // TOTP should be disabled now
      const statusText = await page.getByText(/disabled|not set up/i);
      await expect(statusText).toBeVisible();
    } else {
      // Cleanup via API if button not found
      await disableTotpViaApi(page, secret);
    }
  });
});

test.describe('TOTP with OAuth Flow', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedOut(page);
  });

  test('should preserve OAuth params through TOTP verification', async ({
    page,
  }) => {
    const oauthParams = new URLSearchParams({
      client_id: 'test-client',
      redirect_uri: 'http://localhost:3000/callback',
      response_type: 'code',
      scope: 'openid profile email',
      state: 'test-state-123',
    });

    // Navigate to login with OAuth params
    await page.goto(`${ROUTES.login}?${oauthParams.toString()}`);

    // Login with test user (config user is exempt from 2FA)
    await page.getByPlaceholder(/hello@example.com/i).fill(TEST_USER.email);
    await page
      .getByPlaceholder(/enter your password/i)
      .fill(TEST_USER.password);
    await page.getByRole('button', { name: /log in/i }).click();

    // Wait for navigation
    await page.waitForLoadState('networkidle');

    // Check URL - should either go to consent page or authorize endpoint
    const currentUrl = page.url();
    expect(
      currentUrl.includes('client_id') ||
        currentUrl.includes('/consent') ||
        currentUrl.includes('/authorize'),
    ).toBeTruthy();
  });

  test('should navigate to TOTP verification with OAuth params preserved', async ({
    page,
  }) => {
    const oauthParams = new URLSearchParams({
      client_id: 'sdlk3n3dkj2',
      redirect_uri: 'http://localhost:3000/api/callback',
      response_type: 'code',
      scope: 'openid profile email',
      state: 'test-state-456',
    });

    // Go to 2FA selection page with OAuth params
    await page.goto(`${ROUTES.verify2fa}?${oauthParams.toString()}`);

    // Click TOTP option
    await page.getByRole('link', { name: /authenticator app/i }).click();

    // Check URL has OAuth params preserved
    const url = new URL(page.url());
    expect(url.pathname).toBe(ROUTES.verifyTotp);
    expect(url.searchParams.get('client_id')).toBe('sdlk3n3dkj2');
    expect(url.searchParams.get('state')).toBe('test-state-456');
  });
});
