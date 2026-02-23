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
  cancelButton: 'dialog.modal-open [data-testid="change-password-cancel"]',
  submitButton: 'dialog.modal-open [data-testid="change-password-submit"]',
  fieldError: 'dialog.modal-open [data-testid^="change-password-error"]',
} as const;

/**
 * Selectors for the set password modal.
 */
export const setPasswordModal = {
  newPassword: '#new-password',
  confirmPassword: '#confirm-password',
  cancelButton: 'dialog.modal-open [data-testid="set-password-cancel"]',
  submitButton: 'dialog.modal-open [data-testid="set-password-submit"]',
  fieldError: 'dialog.modal-open [data-testid^="set-password-error"]',
} as const;

/**
 * Selectors for the remove password modal.
 */
export const removePasswordModal = {
  currentPassword: '#current-password-remove',
  cancelButton: 'dialog.modal-open [data-testid="remove-password-cancel"]',
  submitButton: 'dialog.modal-open [data-testid="remove-password-submit"]',
  fieldError: 'dialog.modal-open [data-testid="remove-password-error"]',
} as const;

/**
 * Selectors for the disable TOTP modal.
 */
export const disableTotpModal = {
  codeInput: '#disable-totp-code',
  cancelButton: 'dialog.modal-open [data-testid="disable-totp-cancel"]',
  submitButton: 'dialog.modal-open [data-testid="disable-totp-submit"]',
  fieldError: 'dialog.modal-open [data-testid="disable-totp-error"]',
  warningAlert: 'dialog.modal-open [data-testid="alert-banner-warning"]',
} as const;

/**
 * Selectors for the setup TOTP modal (from profile page).
 */
export const setupTotpModal = {
  qrCodeImage: 'dialog.modal-open img[alt="TOTP QR Code"]',
  nextButton: 'dialog.modal-open [data-testid="totp-qr-next"]',
  pinInput: 'dialog.modal-open input[inputMode="numeric"]',
  recoveryCodesGrid: 'dialog.modal-open [data-testid="recovery-codes-grid"]',
  confirmCheckbox: 'dialog.modal-open [data-testid="recovery-codes-confirm"]',
  confirmButton: 'dialog.modal-open [data-testid="recovery-codes-submit"]',
} as const;

/**
 * Selectors for the delete account modal.
 */
export const deleteAccountModal = {
  confirmInput: '#delete-confirmation',
  cancelButton: 'dialog.modal-open [data-testid="delete-account-cancel"]',
  submitButton: 'dialog.modal-open [data-testid="delete-account-submit"]',
  fieldError: 'dialog.modal-open [data-testid="delete-account-error"]',
  warningAlert: 'dialog.modal-open [data-testid="alert-banner-error"]',
} as const;

/**
 * Selectors for the setup passkey modal.
 */
export const setupPasskeyModal = {
  nameInput: '#passkey-name',
  cancelButton: 'dialog.modal-open [data-testid="setup-passkey-cancel"]',
  continueButton: 'dialog.modal-open [data-testid="setup-passkey-continue"]',
  waitingMessage: 'dialog.modal-open [data-testid="setup-passkey-loading"]',
  fieldError: 'dialog.modal-open [data-testid="setup-passkey-error"]',
} as const;

/**
 * Selectors for the manage passkeys modal.
 */
export const managePasskeysModal = {
  closeButton: 'dialog.modal-open [data-testid="manage-passkeys-close"]',
  addNewButton: 'dialog.modal-open [data-testid="manage-passkeys-add-new"]',
  passkeyItem: 'dialog.modal-open [data-testid="passkey-item"]',
  renameInput: 'dialog.modal-open [data-testid="passkey-rename-input"]',
  deleteError: 'dialog.modal-open [data-testid="alert-banner-error"]',
  emptyState: 'dialog.modal-open [data-testid="passkeys-empty"]',
} as const;

/**
 * Selectors for the unlink OAuth modal.
 */
export const unlinkOAuthModal = {
  cancelButton: 'dialog.modal-open [data-testid="unlink-oauth-cancel"]',
  unlinkButton: 'dialog.modal-open [data-testid="unlink-oauth-unlink"]',
  warningAlert: 'dialog.modal-open [data-testid="alert-banner-warning"]',
  errorAlert: 'dialog.modal-open [data-testid="alert-banner-error"]',
} as const;

/**
 * Generic modal selector.
 */
export const modal = {
  openModal: 'dialog.modal.modal-open',
  closeButton: 'dialog.modal-open [data-testid="modal-close"]',
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
