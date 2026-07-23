import type { Page } from '@playwright/test';

/**
 * Selectors for the profile page (/profile) and its modal dialogs.
 *
 * Uses Playwright CSS selectors that match the profile page's structure.
 * Button text is from the English i18n translation.
 */

export const profilePage = {
  /** Header section */
  logoutButton: '[data-testid="profile-logout"]',
  userEmail: '[data-testid="profile-user-email"]',
  totpRecoveryWarning: '[data-testid="profile-totp-recovery-warning"]',
  totpRegenerateButton: '[data-testid="profile-totp-regenerate"]',
  totpDisableButton: '[data-testid="profile-totp-disable"]',

  /** Password section buttons */
  passwordChangeButton: '[data-testid="profile-password-change"]',
  passwordRemoveButton: '[data-testid="profile-password-remove"]',

  /** Delete account section */
  deleteAccountButton: '[data-testid="profile-delete-account"]',
} as const;

/**
 * Selectors for the change password modal.
 */
export const changePasswordModal = {
  currentPassword: '#current-password',
  newPassword: '#new-password-change',
  confirmPassword: '#confirm-password-change',
  cancelButton: '.tr-dialog-box [data-testid="change-password-cancel"]',
  submitButton: '.tr-dialog-box [data-testid="change-password-submit"]',
  fieldError: '.tr-dialog-box [data-testid^="change-password-error"]',
} as const;

/**
 * Selectors for the set password modal.
 */
export const setPasswordModal = {
  newPassword: '#new-password',
  confirmPassword: '#confirm-password',
  cancelButton: '.tr-dialog-box [data-testid="set-password-cancel"]',
  submitButton: '.tr-dialog-box [data-testid="set-password-submit"]',
  fieldError: '.tr-dialog-box [data-testid^="set-password-error"]',
} as const;

/**
 * Selectors for the remove password modal.
 */
export const removePasswordModal = {
  currentPassword: '#current-password-remove',
  cancelButton: '.tr-dialog-box [data-testid="remove-password-cancel"]',
  submitButton: '.tr-dialog-box [data-testid="remove-password-submit"]',
  fieldError: '.tr-dialog-box [data-testid="remove-password-error"]',
} as const;

/**
 * Selectors for the disable TOTP modal.
 */
export const disableTotpModal = {
  codeInput: '#disable-totp-code',
  cancelButton: '.tr-dialog-box [data-testid="disable-totp-cancel"]',
  submitButton: '.tr-dialog-box [data-testid="disable-totp-submit"]',
  fieldError: '.tr-dialog-box [data-testid="disable-totp-error"]',
  warningAlert: '.tr-dialog-box [data-testid="alert-banner-warning"]',
} as const;

export const regenerateTotpModal = {
  fieldError: '.tr-dialog-box [data-testid="pin-input-error"]',
  errorAlert: '.tr-dialog-box [data-testid="alert-banner-error"]',
  recoveryCodesGrid: '.tr-dialog-box [data-testid="recovery-codes-grid"]',
  confirmCheckbox: '.tr-dialog-box [data-testid="recovery-codes-confirm"]',
  confirmButton: '.tr-dialog-box [data-testid="recovery-codes-submit"]',
} as const;

/**
 * Selectors for the setup TOTP modal (from profile page).
 */
export const setupTotpModal = {
  qrCodeImage: '.tr-dialog-box img[alt="TOTP QR Code"]',
  nextButton: '.tr-dialog-box [data-testid="totp-qr-next"]',
  pinInput: '.tr-dialog-box input[inputMode="numeric"]',
  recoveryCodesGrid: '.tr-dialog-box [data-testid="recovery-codes-grid"]',
  confirmCheckbox: '.tr-dialog-box [data-testid="recovery-codes-confirm"]',
  confirmButton: '.tr-dialog-box [data-testid="recovery-codes-submit"]',
} as const;

/**
 * Selectors for the delete account modal.
 */
export const deleteAccountModal = {
  confirmInput: '#delete-confirmation',
  cancelButton: '.tr-dialog-box [data-testid="delete-account-cancel"]',
  submitButton: '.tr-dialog-box [data-testid="delete-account-submit"]',
  fieldError: '.tr-dialog-box [data-testid="delete-account-error"]',
  warningAlert: '.tr-dialog-box [data-testid="alert-banner-error"]',
} as const;

/**
 * Selectors for the setup passkey modal.
 */
export const setupPasskeyModal = {
  nameInput: '#passkey-name',
  cancelButton: '.tr-dialog-box [data-testid="setup-passkey-cancel"]',
  continueButton: '.tr-dialog-box [data-testid="setup-passkey-continue"]',
  waitingMessage: '.tr-dialog-box [data-testid="setup-passkey-loading"]',
  fieldError: '.tr-dialog-box [data-testid="setup-passkey-error"]',
} as const;

/**
 * Selectors for the manage passkeys modal.
 */
export const managePasskeysModal = {
  closeButton: '.tr-dialog-box [data-testid="manage-passkeys-close"]',
  addNewButton: '.tr-dialog-box [data-testid="manage-passkeys-add-new"]',
  passkeyItem: '.tr-dialog-box [data-testid="passkey-item"]',
  renameInput: '.tr-dialog-box [data-testid="passkey-rename-input"]',
  deleteError: '.tr-dialog-box [data-testid="alert-banner-error"]',
  emptyState: '.tr-dialog-box [data-testid="passkeys-empty"]',
} as const;

/**
 * Selectors for the unlink OAuth modal.
 */
export const unlinkOAuthModal = {
  cancelButton: '.tr-dialog-box [data-testid="unlink-oauth-cancel"]',
  unlinkButton: '.tr-dialog-box [data-testid="unlink-oauth-unlink"]',
  warningAlert: '.tr-dialog-box [data-testid="alert-banner-warning"]',
  errorAlert: '.tr-dialog-box [data-testid="alert-banner-error"]',
} as const;

/**
 * Generic modal selector.
 */
export const modal = {
  openModal: '.tr-dialog-box',
  closeButton: '.tr-dialog-box [data-testid="modal-close"]',
} as const;

/**
 * Performs a login and navigates to the profile page.
 * Useful as a setup step for profile-related tests.
 */
export async function loginAndGoToProfile(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/login/password');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/profile');
}
