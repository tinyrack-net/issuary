import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Page Object for the TOTP setup page (/setup/totp)
 */
export class SetupTotpPage {
  readonly page: Page;

  // Page header
  readonly pageTitle: Locator;

  // Loading state
  readonly loadingSpinner: Locator;

  // QR Step elements
  readonly qrCode: Locator;
  readonly secretKey: Locator;
  readonly nextButton: Locator;

  // Verify Step elements
  readonly pinInputs: Locator;
  readonly verifySubmitButton: Locator;
  readonly backButton: Locator;

  // Recovery Codes Step elements
  readonly recoveryCodes: Locator;
  readonly recoveryCodesList: Locator;
  readonly confirmButton: Locator;
  readonly copyButton: Locator;

  // Error states
  readonly errorAlert: Locator;
  readonly sessionExpiredAlert: Locator;
  readonly alreadyEnabledAlert: Locator;
  readonly retryButton: Locator;
  readonly goToProfileButton: Locator;

  // Links
  readonly backToLoginLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h1');
    this.loadingSpinner = page.locator('.loading-spinner');

    // QR Step
    this.qrCode = page.locator('[data-testid="setup-totp-qr-qr-code"]');
    this.secretKey = page.locator('[data-testid="setup-totp-qr-secret"]');
    this.nextButton = page.locator('[data-testid="setup-totp-qr-next-btn"]');

    // Verify Step
    this.pinInputs = page.locator('[data-testid^="setup-totp-verify-pin-"]');
    this.verifySubmitButton = page.locator(
      '[data-testid="setup-totp-verify-submit-btn"]',
    );
    this.backButton = page.locator(
      '[data-testid="setup-totp-verify-back-btn"]',
    );

    // Recovery Codes Step
    this.recoveryCodes = page.locator(
      '[data-testid="setup-totp-recovery-codes"]',
    );
    this.recoveryCodesList = page.locator(
      '[data-testid^="setup-totp-recovery-code-"]',
    );
    this.confirmButton = page.locator(
      '[data-testid="setup-totp-recovery-confirm-btn"]',
    );
    this.copyButton = page.locator(
      '[data-testid="setup-totp-recovery-copy-btn"]',
    );

    // Error states
    this.errorAlert = page.locator('.alert-error');
    this.sessionExpiredAlert = page.locator('.alert-warning');
    this.alreadyEnabledAlert = page.locator('.alert-info');
    this.retryButton = page.locator('button').filter({ hasText: /retry/i });
    this.goToProfileButton = page
      .locator('button')
      .filter({ hasText: /profile/i });

    // Links
    this.backToLoginLink = page.locator(
      '[data-testid="setup-totp-login-link"]',
    );
  }

  /**
   * Navigate to the TOTP setup page
   */
  async goto() {
    await this.page.goto('/setup/totp');
  }

  /**
   * Wait for the QR code step to be displayed
   */
  async waitForQrStep() {
    await expect(this.qrCode).toBeVisible({ timeout: 10000 });
  }

  /**
   * Click the next button to proceed from QR step to verify step
   */
  async clickNext() {
    await this.nextButton.click();
  }

  /**
   * Fill the 6-digit verification code
   */
  async fillVerificationCode(code: string) {
    const inputs = await this.pinInputs.all();
    for (let i = 0; i < Math.min(code.length, inputs.length); i++) {
      await inputs[i].fill(code[i]);
    }
  }

  /**
   * Submit the verification code
   */
  async submitVerificationCode() {
    await this.verifySubmitButton.click();
  }

  /**
   * Click back button to return to QR step
   */
  async clickBack() {
    await this.backButton.click();
  }

  /**
   * Confirm that recovery codes have been saved
   */
  async confirmRecoveryCodes() {
    await this.confirmButton.click();
  }

  /**
   * Copy recovery codes to clipboard
   */
  async copyRecoveryCodes() {
    await this.copyButton.click();
  }

  /**
   * Get the displayed recovery codes
   */
  async getRecoveryCodes(): Promise<string[]> {
    const codeElements = await this.recoveryCodesList.all();
    const codes: string[] = [];
    for (const element of codeElements) {
      const text = await element.textContent();
      if (text) {
        // Split by whitespace or newlines to handle multiple codes
        codes.push(...text.trim().split(/\s+/));
      }
    }
    return codes.filter((code) => code.length > 0);
  }

  /**
   * Click retry button on error state
   */
  async clickRetry() {
    await this.retryButton.click();
  }

  /**
   * Click go to profile button
   */
  async clickGoToProfile() {
    await this.goToProfileButton.click();
  }

  /**
   * Verify the page is in loading state
   */
  async expectLoading() {
    await expect(this.loadingSpinner).toBeVisible();
  }

  /**
   * Verify QR step is displayed
   */
  async expectQrStep() {
    await expect(this.qrCode).toBeVisible();
    await expect(this.nextButton).toBeVisible();
  }

  /**
   * Verify verification step is displayed
   */
  async expectVerifyStep() {
    await expect(this.pinInputs.first()).toBeVisible();
    await expect(this.verifySubmitButton).toBeVisible();
  }

  /**
   * Verify recovery codes step is displayed
   */
  async expectRecoveryCodesStep() {
    await expect(this.recoveryCodesList.first()).toBeVisible();
    await expect(this.confirmButton).toBeVisible();
  }

  /**
   * Verify error state is displayed
   */
  async expectError() {
    await expect(this.errorAlert).toBeVisible();
  }

  /**
   * Verify session expired state
   */
  async expectSessionExpired() {
    await expect(this.sessionExpiredAlert).toBeVisible();
  }

  /**
   * Verify TOTP already enabled state
   */
  async expectAlreadyEnabled() {
    await expect(this.alreadyEnabledAlert).toBeVisible();
  }

  /**
   * Verify successful setup (redirected to profile)
   */
  async expectSetupSuccess() {
    await expect(this.page).toHaveURL(/\/profile/);
  }
}
