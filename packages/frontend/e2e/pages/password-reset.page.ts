import { type Locator, type Page, expect } from '@playwright/test';

/**
 * Page Object for the password reset page (/password/reset)
 */
export class PasswordResetPage {
  readonly page: Page;

  // Page header
  readonly pageTitle: Locator;

  // Form elements
  readonly tokenInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;

  // Success state
  readonly successAlert: Locator;
  readonly goToLoginButton: Locator;

  // Error messages
  readonly tokenError: Locator;
  readonly tokenErrorAlert: Locator;
  readonly passwordError: Locator;
  readonly confirmPasswordError: Locator;
  readonly formError: Locator;

  // Links
  readonly backToLoginLink: Locator;

  // Loading indicator
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h1');
    this.tokenInput = page.locator('input[type="text"]');
    this.passwordInput = page.locator('input[type="password"]').first();
    this.confirmPasswordInput = page.locator('input[type="password"]').nth(1);
    this.submitButton = page.locator('button[type="submit"]');
    this.successAlert = page.locator('.alert-success');
    this.goToLoginButton = page.locator('button').filter({ hasText: /login/i });
    this.tokenError = page.locator('input[type="text"]').locator('..').locator('~ p.text-error');
    this.tokenErrorAlert = page.locator('.alert-error');
    this.passwordError = page.locator('input[type="password"]').first().locator('..').locator('~ p.text-error');
    this.confirmPasswordError = page.locator('input[type="password"]').nth(1).locator('..').locator('~ p.text-error');
    this.formError = page.locator('.text-error');
    this.backToLoginLink = page.locator('a[href="/login"]');
    this.loadingSpinner = page.locator('.loading-spinner');
  }

  /**
   * Navigate to the password reset page
   */
  async goto(token?: string) {
    if (token) {
      await this.page.goto(`/password/reset?token=${token}`);
    } else {
      await this.page.goto('/password/reset');
    }
  }

  /**
   * Fill the token input (only visible when no token in URL)
   */
  async fillToken(token: string) {
    await this.tokenInput.fill(token);
  }

  /**
   * Fill the new password
   */
  async fillPassword(password: string) {
    await this.passwordInput.fill(password);
  }

  /**
   * Fill the confirm password
   */
  async fillConfirmPassword(confirmPassword: string) {
    await this.confirmPasswordInput.fill(confirmPassword);
  }

  /**
   * Submit the reset password form
   */
  async submit() {
    await this.submitButton.click();
  }

  /**
   * Complete password reset flow
   */
  async resetPassword(password: string, confirmPassword?: string, token?: string) {
    if (token) {
      await this.fillToken(token);
    }
    await this.fillPassword(password);
    await this.fillConfirmPassword(confirmPassword ?? password);
    await this.submit();
  }

  /**
   * Navigate to login page
   */
  async clickGoToLogin() {
    await this.goToLoginButton.click();
  }

  /**
   * Click back to login link
   */
  async clickBackToLogin() {
    await this.backToLoginLink.click();
  }

  /**
   * Verify the page is loaded
   */
  async expectPageLoaded() {
    await expect(this.pageTitle).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.confirmPasswordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  /**
   * Verify success state
   */
  async expectSuccess() {
    await expect(this.successAlert).toBeVisible();
  }

  /**
   * Verify an error message is displayed
   */
  async expectError() {
    await expect(this.formError.first()).toBeVisible();
  }

  /**
   * Verify token error is displayed
   */
  async expectTokenError() {
    // Token error can be shown as:
    // - field error (p.text-error next to input)
    // - alert error (div.alert-error when token is in URL)
    // - general text-error class
    // Need to wait for the API response before checking
    await expect(async () => {
      const hasFieldError = await this.tokenError.isVisible().catch(() => false);
      const hasAlertError = await this.tokenErrorAlert.isVisible().catch(() => false);
      const hasTextError = await this.formError.first().isVisible().catch(() => false);
      expect(hasFieldError || hasAlertError || hasTextError).toBeTruthy();
    }).toPass({ timeout: 10000 });
  }

  /**
   * Verify password error is displayed
   */
  async expectPasswordError() {
    await expect(this.passwordError).toBeVisible();
  }

  /**
   * Verify confirm password error is displayed
   */
  async expectConfirmPasswordError() {
    await expect(this.confirmPasswordError).toBeVisible();
  }

  /**
   * Verify loading state
   */
  async expectLoading() {
    await expect(this.loadingSpinner).toBeVisible();
  }

  /**
   * Verify token input is visible (when no token in URL)
   */
  async expectTokenInputVisible() {
    await expect(this.tokenInput).toBeVisible();
  }

  /**
   * Verify token input is hidden (when token is in URL)
   */
  async expectTokenInputHidden() {
    await expect(this.tokenInput).not.toBeVisible();
  }
}
