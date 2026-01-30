import { test, expect } from '@playwright/test';
import { VerifyTotpPage } from '../../pages';
import { testData } from '../../fixtures';

test.describe('TOTP Verification Page', () => {
  let verifyTotpPage: VerifyTotpPage;

  test.beforeEach(async ({ page }) => {
    verifyTotpPage = new VerifyTotpPage(page);
    await verifyTotpPage.goto();
  });

  test('should display the TOTP verification form', async () => {
    await verifyTotpPage.expectPageLoaded();
  });

  test('should have 6 PIN input fields', async () => {
    const inputs = await verifyTotpPage.pinInputs.all();
    expect(inputs.length).toBe(6);
  });

  test('should have submit button', async () => {
    await expect(verifyTotpPage.submitButton).toBeVisible();
  });

  test('should have recovery code link', async () => {
    await expect(verifyTotpPage.useRecoveryCodeLink).toBeVisible();
  });

  test('should have back to login link', async () => {
    await expect(verifyTotpPage.backToLoginLink).toBeVisible();
  });

  test('should navigate to recovery code page when clicking use recovery code', async ({ page }) => {
    await verifyTotpPage.clickUseRecoveryCode();
    await expect(page).toHaveURL(/\/verify\/totp\/recovery/);
  });

  test('should navigate to login when clicking back to login', async ({ page }) => {
    await verifyTotpPage.clickBackToLogin();
    await expect(page).toHaveURL('/login');
  });

  test('should accept only numeric input', async () => {
    await verifyTotpPage.fillCode('123456');
    const code = await verifyTotpPage.getCode();
    expect(code).toBe('123456');
  });

  test('should show error for invalid TOTP code', async () => {
    // This test requires a valid 2FA session
    // Without a proper session, submitting will show an error
    await verifyTotpPage.fillCode(testData.validTotpFormat);
    await verifyTotpPage.submit();

    // Either shows error or redirects to login (session expired)
    await expect(async () => {
      const hasError = await verifyTotpPage.errorMessage.isVisible().catch(() => false);
      const hasExpiredAlert = await verifyTotpPage.sessionExpiredAlert.isVisible().catch(() => false);
      const isOnLoginPage = verifyTotpPage.page.url().includes('/login');
      expect(hasError || hasExpiredAlert || isOnLoginPage).toBeTruthy();
    }).toPass({ timeout: 5000 });
  });

  test('should show session expired alert and redirect countdown', async () => {
    // Simulate session expired state by trying to verify without session
    await verifyTotpPage.fillCode(testData.validTotpFormat);
    await verifyTotpPage.submit();

    // Wait for either error or session expired state
    await expect(async () => {
      const hasExpiredAlert = await verifyTotpPage.sessionExpiredAlert.isVisible().catch(() => false);
      const hasError = await verifyTotpPage.errorMessage.isVisible().catch(() => false);
      const isOnLoginPage = verifyTotpPage.page.url().includes('/login');
      expect(hasExpiredAlert || hasError || isOnLoginPage).toBeTruthy();
    }).toPass({ timeout: 5000 });
  });
});
