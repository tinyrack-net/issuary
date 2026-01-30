import { type Locator, type Page, expect } from '@playwright/test';

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
    this.emailInput = page.locator('input[type="email"]');
    this.submitButton = page.locator('button[type="submit"]');
    this.successAlert = page.locator('.alert-success');
    this.checkSpamInfo = page.locator('.alert-info');
    this.backToLoginButton = page.locator('a[href="/login"]').filter({ hasText: /login/i });
    this.emailError = page.locator('input[type="email"]').locator('..').locator('~ p.text-error');
    this.formError = page.locator('.text-error');
    this.loginLink = page.locator('a[href="/login"]');
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
    await expect(this.formError.first()).toBeVisible();
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
