import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Page Object for the email verification page (/verify/email)
 */
export class VerifyEmailPage {
  readonly page: Page;

  // Page header
  readonly pageTitle: Locator;

  // Form elements
  readonly tokenInput: Locator;
  readonly submitButton: Locator;

  // Resend button
  readonly resendButton: Locator;

  // Alerts
  readonly infoAlert: Locator;
  readonly successAlert: Locator;
  readonly errorMessage: Locator;

  // Success state
  readonly goToProfileButton: Locator;

  // Loading indicator
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h1');
    this.tokenInput = page.locator('[data-testid="verify-email-token-input"]');
    this.submitButton = page.locator('[data-testid="verify-email-submit-btn"]');
    this.resendButton = page.locator('[data-testid="verify-email-resend-btn"]');
    this.infoAlert = page.locator('[data-testid="verify-email-info-alert"]');
    this.successAlert = page.locator(
      '[data-testid="verify-email-success-alert"]',
    );
    this.errorMessage = page.locator(
      '[data-testid="verify-email-token-input-error"]',
    );
    this.goToProfileButton = page.locator(
      '[data-testid="verify-email-profile-btn"]',
    );
    this.loadingSpinner = page.locator('.loading-spinner');
  }

  /**
   * Navigate to the email verification page
   */
  async goto(params?: { token?: string; email?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.token) searchParams.set('token', params.token);
    if (params?.email) searchParams.set('email', params.email);
    const query = searchParams.toString();
    await this.page.goto(`/verify/email${query ? `?${query}` : ''}`);
  }

  /**
   * Fill the token input
   */
  async fillToken(token: string) {
    await this.tokenInput.fill(token);
  }

  /**
   * Submit the verification form
   */
  async submit() {
    await this.submitButton.click();
  }

  /**
   * Verify email with a token
   */
  async verify(token: string) {
    await this.fillToken(token);
    await this.submit();
  }

  /**
   * Click the resend verification button
   */
  async clickResend() {
    await this.resendButton.click();
  }

  /**
   * Click go to profile button after successful verification
   */
  async clickGoToProfile() {
    await this.goToProfileButton.click();
  }

  /**
   * Verify the page is loaded
   */
  async expectPageLoaded() {
    await expect(this.pageTitle).toBeVisible();
    await expect(this.tokenInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }

  /**
   * Verify an error message is displayed
   */
  async expectError() {
    await expect(this.errorMessage).toBeVisible();
  }

  /**
   * Verify success state
   */
  async expectSuccess() {
    await expect(this.successAlert).toBeVisible();
  }

  /**
   * Verify resend success message
   */
  async expectResendSuccess() {
    await expect(this.successAlert).toBeVisible();
  }

  /**
   * Verify loading state
   */
  async expectLoading() {
    await expect(this.loadingSpinner).toBeVisible();
  }

  /**
   * Verify info alert about email sent is visible
   */
  async expectEmailSentInfo() {
    await expect(this.infoAlert).toBeVisible();
  }
}
