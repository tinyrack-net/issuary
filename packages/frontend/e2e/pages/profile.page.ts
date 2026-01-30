import { type Locator, type Page, expect } from '@playwright/test';

/**
 * Page Object for the profile page (/profile)
 */
export class ProfilePage {
  readonly page: Page;

  // Header elements
  readonly pageTitle: Locator;
  readonly userEmail: Locator;
  readonly verifiedBadge: Locator;
  readonly logoutButton: Locator;
  readonly avatar: Locator;

  // Account Information section
  readonly accountInfoSection: Locator;
  readonly userId: Locator;

  // Security section
  readonly securitySection: Locator;

  // Password section
  readonly passwordSection: Locator;
  readonly setPasswordButton: Locator;
  readonly changePasswordButton: Locator;
  readonly removePasswordButton: Locator;

  // TOTP section
  readonly totpSection: Locator;
  readonly enableTotpButton: Locator;
  readonly disableTotpButton: Locator;

  // Passkey section
  readonly passkeySection: Locator;
  readonly addPasskeyButton: Locator;
  readonly managePasskeysButton: Locator;

  // OAuth section
  readonly linkedAccountsSection: Locator;

  // Danger zone
  readonly dangerZoneSection: Locator;
  readonly deleteAccountButton: Locator;

  // Modals
  readonly modal: Locator;
  readonly modalCloseButton: Locator;

  // Loading indicator
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    this.page = page;

    // Header
    this.pageTitle = page.locator('h1');
    this.userEmail = page.locator('h1').locator('..').locator('p');
    this.verifiedBadge = page.locator('.text-success').filter({ hasText: /verified/i });
    this.logoutButton = page.locator('button').filter({ has: page.locator('[class*="SignOut"]') });
    this.avatar = page.locator('[class*="avatar"]');

    // Account Information
    this.accountInfoSection = page.locator('div').filter({ hasText: /account information/i }).first();
    this.userId = page.locator('text=/User ID/i').locator('..').locator('span');

    // Security section
    this.securitySection = page.locator('h2').filter({ hasText: /security/i }).locator('..');

    // Password section
    this.passwordSection = page.locator('[class*="password"]').first();
    this.setPasswordButton = page.locator('button').filter({ hasText: /^set$/i });
    this.changePasswordButton = page.locator('button').filter({ hasText: /^change$/i });
    this.removePasswordButton = page.locator('button').filter({ hasText: /^remove$/i });

    // TOTP section
    this.totpSection = page.locator('[class*="totp"]').first();
    this.enableTotpButton = page.locator('button').filter({ hasText: /^enable$/i });
    this.disableTotpButton = page.locator('button').filter({ hasText: /^disable$/i });

    // Passkey section
    this.passkeySection = page.locator('[class*="passkey"]').first();
    this.addPasskeyButton = page.locator('button').filter({ hasText: /^add$/i });
    this.managePasskeysButton = page.locator('button').filter({ hasText: /^manage$/i });

    // OAuth section
    this.linkedAccountsSection = page.locator('h2').filter({ hasText: /linked accounts/i }).locator('..');

    // Danger zone
    this.dangerZoneSection = page.locator('h2').filter({ hasText: /danger zone/i }).locator('..');
    this.deleteAccountButton = page.locator('button').filter({ hasText: /delete account/i });

    // Modal
    this.modal = page.locator('dialog.modal');
    this.modalCloseButton = page.locator('dialog.modal button').filter({ hasText: /×|close|cancel/i });

    // Loading
    this.loadingSpinner = page.locator('.loading-spinner');
  }

  /**
   * Navigate to the profile page
   */
  async goto() {
    await this.page.goto('/profile');
  }

  /**
   * Click the logout button
   */
  async logout() {
    await this.logoutButton.click();
  }

  /**
   * Click set password button
   */
  async clickSetPassword() {
    await this.setPasswordButton.click();
  }

  /**
   * Click change password button
   */
  async clickChangePassword() {
    await this.changePasswordButton.click();
  }

  /**
   * Click remove password button
   */
  async clickRemovePassword() {
    await this.removePasswordButton.click();
  }

  /**
   * Click enable TOTP button
   */
  async clickEnableTotp() {
    await this.enableTotpButton.click();
  }

  /**
   * Click disable TOTP button
   */
  async clickDisableTotp() {
    await this.disableTotpButton.click();
  }

  /**
   * Click add passkey button
   */
  async clickAddPasskey() {
    await this.addPasskeyButton.click();
  }

  /**
   * Click manage passkeys button
   */
  async clickManagePasskeys() {
    await this.managePasskeysButton.click();
  }

  /**
   * Click delete account button
   */
  async clickDeleteAccount() {
    await this.deleteAccountButton.click();
  }

  /**
   * Close the currently open modal
   */
  async closeModal() {
    await this.modalCloseButton.click();
  }

  /**
   * Verify the page is loaded
   */
  async expectPageLoaded() {
    await expect(this.pageTitle).toBeVisible();
    await expect(this.logoutButton).toBeVisible();
  }

  /**
   * Verify user email is displayed
   */
  async expectUserEmail(email: string) {
    await expect(this.page.locator(`text=${email}`)).toBeVisible();
  }

  /**
   * Verify email is verified
   */
  async expectEmailVerified() {
    await expect(this.verifiedBadge).toBeVisible();
  }

  /**
   * Verify a modal is open
   */
  async expectModalOpen() {
    await expect(this.modal).toBeVisible();
  }

  /**
   * Verify modal is closed
   */
  async expectModalClosed() {
    await expect(this.modal).not.toBeVisible();
  }

  /**
   * Verify redirected to login after logout
   */
  async expectLogoutSuccess() {
    await expect(this.page).toHaveURL(/\/login/);
  }

  /**
   * Verify password is set
   */
  async expectPasswordSet() {
    await expect(this.changePasswordButton).toBeVisible();
  }

  /**
   * Verify password is not set
   */
  async expectPasswordNotSet() {
    await expect(this.setPasswordButton).toBeVisible();
  }

  /**
   * Verify TOTP is enabled
   */
  async expectTotpEnabled() {
    await expect(this.disableTotpButton).toBeVisible();
  }

  /**
   * Verify TOTP is disabled
   */
  async expectTotpDisabled() {
    await expect(this.enableTotpButton).toBeVisible();
  }
}
