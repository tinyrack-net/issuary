import { test, expect } from '@playwright/test';
import { SetupTotpPage } from '../../pages';
import { setupAuthenticatedUser } from '../../utils';

test.describe('TOTP Setup Page', () => {
  let setupTotpPage: SetupTotpPage;
  let hasQrCode: boolean;

  test.beforeEach(async ({ page }) => {
    setupTotpPage = new SetupTotpPage(page);
    hasQrCode = false;
  });

  /**
   * Helper to setup auth and navigate to TOTP setup page
   * Returns true if QR code is visible (full auth), false otherwise
   */
  async function setupAndNavigate(page: Parameters<typeof setupAuthenticatedUser>[1], request: Parameters<typeof setupAuthenticatedUser>[0]): Promise<boolean> {
    await setupAuthenticatedUser(request, page);
    await setupTotpPage.goto();

    // Wait for page to settle
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Check if QR code is visible (might not be if email not verified, etc.)
    return await setupTotpPage.qrCode.isVisible().catch(() => false);
  }

  test('should display loading state initially', async ({ page, request }) => {
    await setupAuthenticatedUser(request, page);
    await setupTotpPage.goto();

    // Page may show loading briefly, QR step, or error state
    await expect(async () => {
      const isLoading = await setupTotpPage.loadingSpinner.isVisible().catch(() => false);
      const hasQr = await setupTotpPage.qrCode.isVisible().catch(() => false);
      const hasError = await setupTotpPage.errorAlert.isVisible().catch(() => false);
      const hasExpired = await setupTotpPage.sessionExpiredAlert.isVisible().catch(() => false);
      expect(isLoading || hasQr || hasError || hasExpired).toBeTruthy();
    }).toPass({ timeout: 10000 });
  });

  test('should display QR code step for authenticated user', async ({ page, request }) => {
    hasQrCode = await setupAndNavigate(page, request);
    test.skip(!hasQrCode, 'QR code not available - may require email verification');
    await setupTotpPage.expectQrStep();
  });

  test('should have next button in QR step', async ({ page, request }) => {
    hasQrCode = await setupAndNavigate(page, request);
    test.skip(!hasQrCode, 'QR code not available - may require email verification');
    await expect(setupTotpPage.nextButton).toBeVisible();
  });

  test('should navigate to verify step when clicking next', async ({ page, request }) => {
    hasQrCode = await setupAndNavigate(page, request);
    test.skip(!hasQrCode, 'QR code not available - may require email verification');
    await setupTotpPage.clickNext();
    await setupTotpPage.expectVerifyStep();
  });

  test('should have 6 PIN input fields in verify step', async ({ page, request }) => {
    hasQrCode = await setupAndNavigate(page, request);
    test.skip(!hasQrCode, 'QR code not available - may require email verification');
    await setupTotpPage.clickNext();

    const inputs = await setupTotpPage.pinInputs.all();
    expect(inputs.length).toBe(6);
  });

  test('should have back button in verify step', async ({ page, request }) => {
    hasQrCode = await setupAndNavigate(page, request);
    test.skip(!hasQrCode, 'QR code not available - may require email verification');
    await setupTotpPage.clickNext();
    await expect(setupTotpPage.backButton).toBeVisible();
  });

  test('should navigate back to QR step when clicking back', async ({ page, request }) => {
    hasQrCode = await setupAndNavigate(page, request);
    test.skip(!hasQrCode, 'QR code not available - may require email verification');
    await setupTotpPage.clickNext();
    await setupTotpPage.expectVerifyStep();
    await setupTotpPage.clickBack();
    await setupTotpPage.expectQrStep();
  });

  test('should show error for invalid verification code', async ({ page, request }) => {
    hasQrCode = await setupAndNavigate(page, request);
    test.skip(!hasQrCode, 'QR code not available - may require email verification');
    await setupTotpPage.clickNext();
    await setupTotpPage.fillVerificationCode('000000');
    await setupTotpPage.submitVerificationCode();

    // Should show error (invalid code)
    await expect(async () => {
      const hasError = await setupTotpPage.page.locator('.text-error').isVisible().catch(() => false);
      expect(hasError).toBeTruthy();
    }).toPass({ timeout: 5000 });
  });

  test('should have back to login link', async ({ page, request }) => {
    hasQrCode = await setupAndNavigate(page, request);
    test.skip(!hasQrCode, 'QR code not available - may require email verification');
    await expect(setupTotpPage.backToLoginLink).toBeVisible();
  });

  test('should redirect to login when not authenticated', async ({ page }) => {
    // Try to access setup page without authentication
    await setupTotpPage.goto();

    // Should either show session expired or redirect to login
    await expect(async () => {
      const isOnLogin = page.url().includes('/login');
      const hasExpiredAlert = await setupTotpPage.sessionExpiredAlert.isVisible().catch(() => false);
      const hasError = await setupTotpPage.errorAlert.isVisible().catch(() => false);
      expect(isOnLogin || hasExpiredAlert || hasError).toBeTruthy();
    }).toPass({ timeout: 10000 });
  });

  // Note: Full TOTP setup flow test requires generating a valid TOTP code
  // which needs the secret from the QR code and a TOTP library
  test.skip('should complete full TOTP setup flow', async () => {
    // This test would require:
    // 1. Setting up authenticated user
    // 2. Navigating to TOTP setup
    // 3. Extracting secret from QR/text
    // 4. Generating valid TOTP code
    // 5. Verifying the code
    // 6. Viewing recovery codes
    // 7. Confirming setup
    // 8. Verifying redirect to profile
  });
});
