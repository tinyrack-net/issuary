import { type Locator, type Page, expect } from '@playwright/test';

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
    this.pinInputs = page.locator('input[inputmode="numeric"]');
    this.pinContainer = page.locator('[class*="pin-input"]');
    this.submitButton = page.locator('button[type="submit"]');
    this.useRecoveryCodeLink = page.locator('button').filter({ hasText: /recovery/i });
    this.backToLoginLink = page.locator('a[href="/login"]');
    this.sessionExpiredAlert = page.locator('.alert-warning');
    this.errorMessage = page.locator('.text-error');
    this.loadingSpinner = page.locator('.loading-spinner');
    this.redirectNowButton = page.locator('button').filter({ hasText: /redirect now/i });
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
