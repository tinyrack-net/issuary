import { type Locator, type Page, expect } from '@playwright/test';

/**
 * Page Object for the registration page (/register)
 */
export class RegisterPage {
  readonly page: Page;

  // Form elements
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  // Terms checkboxes (if present)
  readonly termsCheckboxes: Locator;

  // Links
  readonly loginLink: Locator;

  // Error messages
  readonly emailError: Locator;
  readonly passwordError: Locator;
  readonly formError: Locator;

  // Loading indicator
  readonly loadingSpinner: Locator;

  // Implicit notice (if configured)
  readonly implicitNotice: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[type="email"]');
    this.passwordInput = page.locator('input[type="password"]');
    this.submitButton = page.locator('button[type="submit"]');
    this.termsCheckboxes = page.locator('input[type="checkbox"][name*="termsConsents"]');
    this.loginLink = page.locator('a[href="/login"]');
    this.emailError = page.locator('input[type="email"]').locator('..').locator('~ p.text-error');
    this.passwordError = page.locator('input[type="password"]').locator('..').locator('~ p.text-error');
    this.formError = page.locator('.text-error');
    this.loadingSpinner = page.locator('.loading-spinner');
    this.implicitNotice = page.locator('[class*="implicit-notice"]');
  }

  /**
   * Navigate to the registration page
   */
  async goto() {
    await this.page.goto('/register');
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
   * Submit the registration form
   */
  async submit() {
    await this.submitButton.click();
  }

  /**
   * Check all terms checkboxes if present
   */
  async acceptAllTerms() {
    const checkboxes = await this.termsCheckboxes.all();
    for (const checkbox of checkboxes) {
      await checkbox.check();
    }
  }

  /**
   * Perform a complete registration flow
   */
  async register(email: string, password: string, acceptTerms = true) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    if (acceptTerms) {
      await this.acceptAllTerms();
    }
    await this.submit();
  }

  /**
   * Navigate to login page
   */
  async clickLogin() {
    await this.loginLink.click();
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
    await expect(this.formError.first()).toBeVisible();
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
   * Verify registration was successful (redirected to verify email or profile)
   */
  async expectRegisterSuccess() {
    await expect(this.page).toHaveURL(/\/(verify\/email|profile)/);
  }

  /**
   * Check if terms checkboxes are present
   */
  async hasTermsCheckboxes(): Promise<boolean> {
    return (await this.termsCheckboxes.count()) > 0;
  }
}
