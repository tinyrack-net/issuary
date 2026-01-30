import { type Locator, type Page, expect } from '@playwright/test';

/**
 * Page Object for the password login page (/login/password)
 */
export class LoginPasswordPage {
  readonly page: Page;

  // Form elements
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  // Links
  readonly forgotPasswordLink: Locator;
  readonly registerLink: Locator;

  // Error messages
  readonly emailError: Locator;
  readonly passwordError: Locator;
  readonly formError: Locator;

  // Loading indicator
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[type="email"]');
    this.passwordInput = page.locator('input[type="password"]');
    this.submitButton = page.locator('button[type="submit"]');
    this.forgotPasswordLink = page.locator('a[href="/password/forgot"]');
    this.registerLink = page.locator('a[href="/register"]');
    this.emailError = page.locator('input[type="email"]').locator('..').locator('~ p.text-error');
    this.passwordError = page.locator('input[type="password"]').locator('..').locator('~ p.text-error');
    this.formError = page.locator('.text-error');
    this.loadingSpinner = page.locator('.loading-spinner');
  }

  /**
   * Navigate to the password login page
   */
  async goto() {
    await this.page.goto('/login/password');
  }

  /**
   * Fill the email input
   */
  async fillEmail(email: string) {
    await this.emailInput.fill(email);
  }

  /**
   * Fill the password input
   */
  async fillPassword(password: string) {
    await this.passwordInput.fill(password);
  }

  /**
   * Submit the login form
   */
  async submit() {
    await this.submitButton.click();
  }

  /**
   * Perform a complete login flow
   */
  async login(email: string, password: string) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submit();
  }

  /**
   * Navigate to forgot password page
   */
  async clickForgotPassword() {
    await this.forgotPasswordLink.click();
  }

  /**
   * Navigate to register page
   */
  async clickRegister() {
    await this.registerLink.click();
  }

  /**
   * Verify the page is loaded
   */
  async expectPageLoaded() {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
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
      const hasTextError = await this.formError.first().isVisible().catch(() => false);
      const hasInputError = await this.page.locator('.input-error').first().isVisible().catch(() => false);
      const hasAlertError = await this.page.locator('.alert-error').first().isVisible().catch(() => false);
      // Check for HTML5 validation state
      const hasInvalidInput = await this.page.locator('input:invalid').first().isVisible().catch(() => false);
      expect(hasTextError || hasInputError || hasAlertError || hasInvalidInput).toBeTruthy();
    }).toPass({ timeout: 5000 });
  }

  /**
   * Verify email field has an error
   */
  async expectEmailError() {
    await expect(this.emailError).toBeVisible();
  }

  /**
   * Verify password field has an error
   */
  async expectPasswordError() {
    await expect(this.passwordError).toBeVisible();
  }

  /**
   * Verify loading state
   */
  async expectLoading() {
    await expect(this.loadingSpinner).toBeVisible();
  }

  /**
   * Wait for navigation to profile page after successful login
   */
  async expectLoginSuccess() {
    await expect(this.page).toHaveURL(/\/profile/);
  }
}
