import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Page Object for the login method selection page (/login)
 */
export class LoginPage {
  readonly page: Page;

  // Page header
  readonly pageTitle: Locator;

  // Login method buttons
  readonly passwordMethodButton: Locator;
  readonly passkeyMethodButton: Locator;

  // OAuth buttons (generic locator for OAuth providers)
  readonly oauthButtons: Locator;

  // Error alert
  readonly errorAlert: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.locator('h1');
    this.passwordMethodButton = page.locator(
      '[data-testid="login-password-method-btn"]',
    );
    this.passkeyMethodButton = page.locator(
      '[data-testid="login-passkey-method-btn"]',
    );
    this.oauthButtons = page.locator('[data-testid^="login-oauth-"]');
    this.errorAlert = page.locator('[data-testid="login-oauth-error-alert"]');
  }

  /**
   * Navigate to the login page
   */
  async goto() {
    await this.page.goto('/login');
  }

  /**
   * Click on the password login method
   */
  async clickPasswordMethod() {
    await this.passwordMethodButton.click();
  }

  /**
   * Click on the passkey login method
   */
  async clickPasskeyMethod() {
    await this.passkeyMethodButton.click();
  }

  /**
   * Get all OAuth provider buttons
   */
  async getOAuthProviders() {
    return this.oauthButtons.all();
  }

  /**
   * Verify the page is loaded
   */
  async expectPageLoaded() {
    await expect(this.pageTitle).toBeVisible();
  }

  /**
   * Verify an error alert is displayed
   */
  async expectError() {
    await expect(this.errorAlert).toBeVisible();
  }

  /**
   * Verify password method is available
   */
  async expectPasswordMethodVisible() {
    await expect(this.passwordMethodButton).toBeVisible();
  }
}
