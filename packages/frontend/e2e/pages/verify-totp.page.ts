import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Page Object for the TOTP verification page (/verify/totp)
 */
export class VerifyTotpPage {
  readonly page: Page;

  // Page header
  readonly pageTitle: Locator;

  // PIN input (6-digit code)
  readonly pinInputs: Locator;
  readonly pinContainer: Locator;

  // Submit button
  readonly submitButton: Locator;

  // Links
  readonly useRecoveryCodeLink: Locator;
  readonly backToLoginLink: Locator;

  // Alerts
  readonly sessionExpiredAlert: Locator;
  readonly errorMessage: Locator;

  // Loading indicator
  readonly loadingSpinner: Locator;

  // Redirect button (when session expired)
  readonly redirectNowButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h1');
    // Use data-testid pattern for pin inputs: verify-totp-pin-0 through verify-totp-pin-5
    this.pinInputs = page.locator('[data-testid^="verify-totp-pin-"]');
    this.pinContainer = page.locator('[class*="pin-input"]');
    this.submitButton = page.locator('[data-testid="verify-totp-submit-btn"]');
    this.useRecoveryCodeLink = page.locator(
      '[data-testid="verify-totp-recovery-link"]',
    );
    this.backToLoginLink = page.locator(
      '[data-testid="verify-totp-login-link"]',
    );
    this.sessionExpiredAlert = page.locator(
      '[data-testid="verify-totp-expired-alert"]',
    );
    this.errorMessage = page.locator('[data-testid="verify-totp-pin-error"]');
    this.loadingSpinner = page.locator('.loading-spinner');
    this.redirectNowButton = page.locator(
      '[data-testid="verify-totp-redirect-btn"]',
    );
  }

  /**
   * Navigate to the TOTP verification page
   */
  async goto() {
    await this.page.goto('/verify/totp');
  }

  /**
   * Fill the 6-digit TOTP code
   */
  async fillCode(code: string) {
    // PIN input component - fill each digit
    const inputs = await this.pinInputs.all();
    for (let i = 0; i < Math.min(code.length, inputs.length); i++) {
      await inputs[i].fill(code[i]);
    }
  }

  /**
   * Clear the PIN input
   */
  async clearCode() {
    const inputs = await this.pinInputs.all();
    for (const input of inputs) {
      await input.clear();
    }
  }

  /**
   * Submit the TOTP verification form
   */
  async submit() {
    await this.submitButton.click();
  }

  /**
   * Verify with a TOTP code
   */
  async verify(code: string) {
    await this.fillCode(code);
    // Note: The form may auto-submit on complete, but we click submit to be safe
    await this.submit();
  }

  /**
   * Click use recovery code link
   */
  async clickUseRecoveryCode() {
    await this.useRecoveryCodeLink.click();
  }

  /**
   * Click back to login link
   */
  async clickBackToLogin() {
    await this.backToLoginLink.click();
  }

  /**
   * Click redirect now button when session expired
   */
  async clickRedirectNow() {
    await this.redirectNowButton.click();
  }

  /**
   * Verify the page is loaded
   */
  async expectPageLoaded() {
    await expect(this.pageTitle).toBeVisible();
    await expect(this.pinInputs.first()).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  /**
   * Verify an error message is displayed
   */
  async expectError() {
    await expect(this.errorMessage).toBeVisible();
  }

  /**
   * Verify session expired alert is visible
   */
  async expectSessionExpired() {
    await expect(this.sessionExpiredAlert).toBeVisible();
  }

  /**
   * Verify loading state
   */
  async expectLoading() {
    await expect(this.loadingSpinner).toBeVisible();
  }

  /**
   * Verify successful TOTP verification (redirected to profile)
   */
  async expectVerifySuccess() {
    await expect(this.page).toHaveURL(/\/profile/);
  }

  /**
   * Get the current value in the PIN inputs
   */
  async getCode(): Promise<string> {
    const inputs = await this.pinInputs.all();
    let code = '';
    for (const input of inputs) {
      code += await input.inputValue();
    }
    return code;
  }
}
