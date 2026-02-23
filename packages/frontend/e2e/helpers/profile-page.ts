import type { Page } from '@playwright/test';

/**
 * Selectors for the profile page (/profile) and its modal dialogs.
 *
 * Uses Playwright CSS selectors that match the profile page's structure.
 * Button text is from the English i18n translation.
 */

export const profilePage = {
  /** Header section */
  logoutButton: 'button.btn-ghost.btn-sm',
  userEmail: '.text-base-content\\/70.text-sm',

  /** Password section buttons (use getByRole in tests for text matching) */
  passwordChangeButton: 'button.btn-ghost.btn-xs.text-primary',
  passwordRemoveButton: 'button.btn-ghost.btn-xs.text-error',

  /** Delete account section */
  deleteAccountButton: 'button.btn-error',
} as const;

/**
 * Selectors for the change password modal.
 */
export const changePasswordModal = {
  currentPassword: '#current-password',
  newPassword: '#new-password-change',
  confirmPassword: '#confirm-password-change',
  cancelButton: 'dialog.modal-open button.btn.btn-sm:not(.btn-primary)',
  submitButton: 'dialog.modal-open button.btn.btn-sm.btn-primary',
  fieldError: 'dialog.modal-open .text-error',
} as const;

/**
 * Selectors for the set password modal.
 */
export const setPasswordModal = {
  newPassword: '#new-password',
  confirmPassword: '#confirm-password',
  cancelButton: 'dialog.modal-open button.btn.btn-sm:not(.btn-primary)',
  submitButton: 'dialog.modal-open button.btn.btn-sm.btn-primary',
  fieldError: 'dialog.modal-open .text-error',
} as const;

/**
 * Selectors for the remove password modal.
 */
export const removePasswordModal = {
  currentPassword: '#current-password-remove',
  cancelButton: 'dialog.modal-open button.btn.btn-sm:not(.btn-error)',
  submitButton: 'dialog.modal-open button.btn.btn-sm.btn-error',
  fieldError: 'dialog.modal-open .text-error',
} as const;

/**
 * Selectors for the disable TOTP modal.
 */
export const disableTotpModal = {
  codeInput: '#disable-totp-code',
  cancelButton: 'dialog.modal-open button.btn.btn-sm:not(.btn-error)',
  submitButton: 'dialog.modal-open button.btn.btn-sm.btn-error',
  fieldError: 'dialog.modal-open .text-error',
  warningAlert: 'dialog.modal-open .text-warning',
} as const;

/**
 * Selectors for the setup TOTP modal (from profile page).
 */
export const setupTotpModal = {
  qrCodeImage: 'dialog.modal-open img[alt="TOTP QR Code"]',
  nextButton: 'dialog.modal-open .btn.btn-primary.btn-block',
  pinInput: 'dialog.modal-open input[inputMode="numeric"]',
  recoveryCodesGrid: 'dialog.modal-open .grid.grid-cols-2',
  confirmCheckbox: 'dialog.modal-open input[type="checkbox"].checkbox',
  confirmButton: 'dialog.modal-open .btn.btn-primary.btn-block',
} as const;

/**
 * Selectors for the delete account modal.
 */
export const deleteAccountModal = {
  confirmInput: '#delete-confirmation',
  cancelButton: 'dialog.modal-open button.btn.btn-sm:not(.btn-error)',
  submitButton: 'dialog.modal-open button.btn.btn-sm.btn-error',
  fieldError: 'dialog.modal-open .text-error',
  warningAlert: 'dialog.modal-open .alert-error',
} as const;

/**
 * Selectors for the setup passkey modal.
 */
export const setupPasskeyModal = {
  nameInput: '#passkey-name',
  cancelButton: 'dialog.modal-open button.btn.btn-sm:not(.btn-primary)',
  continueButton: 'dialog.modal-open button.btn.btn-sm.btn-primary',
  waitingMessage: 'dialog.modal-open .loading.loading-spinner',
  fieldError: 'dialog.modal-open .text-error',
} as const;

/**
 * Selectors for the manage passkeys modal.
 */
export const managePasskeysModal = {
  closeButton:
    'dialog.modal-open .modal-action button.btn.btn-sm:not(.btn-primary)',
  addNewButton: 'dialog.modal-open .modal-action button.btn.btn-sm.btn-primary',
  passkeyItem: 'dialog.modal-open .rounded-lg.bg-base-200',
  deleteError: 'dialog.modal-open .alert-error',
  emptyState: 'dialog.modal-open .text-base-content\\/60.text-sm',
} as const;

/**
 * Selectors for the unlink OAuth modal.
 */
export const unlinkOAuthModal = {
  cancelButton: 'dialog.modal-open button.btn.btn-sm:not(.btn-error)',
  unlinkButton: 'dialog.modal-open button.btn.btn-sm.btn-error',
  warningAlert: 'dialog.modal-open .text-warning',
  errorAlert: 'dialog.modal-open .text-error',
} as const;

/**
 * Generic modal selector.
 */
export const modal = {
  openModal: 'dialog.modal.modal-open',
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
