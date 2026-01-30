import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Page Object for the forgot password page (/password/forgot)
 */
export class PasswordForgotPage {
  readonly page: Page;

  // Page header
  readonly pageTitle: Locator;

  // Form elements
  readonly emailInput: Locator;
  readonly submitButton: Locator;

  // Success state
  readonly successAlert: Locator;
  readonly checkSpamInfo: Locator;
  readonly backToLoginButton: Locator;

  // Error messages
  readonly emailError: Locator;
  readonly formError: Locator;

  // Links
  readonly loginLink: Locator;

  // Loading indicator
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h1');
    this.emailInput = page.locator(
      '[data-testid="password-forgot-email-input"]',
    );
    this.submitButton = page.locator(
      '[data-testid="password-forgot-submit-btn"]',
    );
    this.successAlert = page.locator(
      '[data-testid="password-forgot-success-alert"]',
    );
    this.checkSpamInfo = page.locator(
      '[data-testid="password-forgot-spam-alert"]',
    );
    this.backToLoginButton = page.locator(
      '[data-testid="password-forgot-login-btn"]',
    );
    this.emailError = page.locator(
      '[data-testid="password-forgot-email-input-error"]',
    );
    this.formError = page.locator('.text-error');
    this.loginLink = page.locator('[data-testid="password-forgot-login-link"]');
    this.loadingSpinner = page.locator('.loading-spinner');
  }

  /**
   * Navigate to the forgot password page
   */
  async goto() {
    await this.page.goto('/password/forgot');
  }

  /**
   * Fill the email input
   */
  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  /**
   * Submit the forgot password form
   */
  async submit() {
    await this.submitButton.click();
  }

  /**
   * Request password reset for an email
   */
  async requestReset(email: string) {
    await this.fillEmail(email);
    await this.submit();
  }

  /**
   * Navigate back to login page
   */
  async clickBackToLogin() {
    await this.backToLoginButton.click();
  }

  /**
   * Verify the page is loaded
   */
  async expectPageLoaded() {
    await expect(this.pageTitle).toBeVisible();
    await expect(this.emailInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  /**
   * Verify success state (email sent)
   */
  async expectSuccess() {
    await expect(this.successAlert).toBeVisible();
  }

  /**
   * Verify check spam info is visible
   */
  async expectCheckSpamInfo() {
    await expect(this.checkSpamInfo).toBeVisible();
  }

  /**
   * Verify an error message is displayed
   */
  async expectError() {
    // Wait for any error indicator to appear:
    // - .text-error class (inline errors)
    // - input-error class (input border)
    // - alert-error class (form-level errors)
    // - HTML5 validation (input:invalid)
    await expect(async () => {
      const hasTextError = await this.formError
        .first()
        .isVisible()
        .catch(() => false);
      const hasInputError = await this.page
        .locator('.input-error')
        .first()
        .isVisible()
        .catch(() => false);
      const hasAlertError = await this.page
        .locator('.alert-error')
        .first()
        .isVisible()
        .catch(() => false);
      // Check for HTML5 validation state
      const hasInvalidInput = await this.page
        .locator('input:invalid')
        .first()
        .isVisible()
        .catch(() => false);
      expect(
        hasTextError || hasInputError || hasAlertError || hasInvalidInput,
      ).toBeTruthy();
    }).toPass({ timeout: 5000 });
  }

  /**
   * Verify email field has an error
   */
  async expectEmailError() {
    await expect(this.emailError).toBeVisible();
  }

  /**
   * Verify loading state
   */
  async expectLoading() {
    await expect(this.loadingSpinner).toBeVisible();
  }
}
