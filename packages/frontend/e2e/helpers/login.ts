import type { Page } from '@playwright/test';

/**
 * Selectors for the login method selection page (/login).
 */
export const loginMethodPage = {
  passwordMethodLink: 'a[href^="/login/password"]',
} as const;

/**
 * Selectors for the password login page (/login/password).
 */
export const loginPasswordPage = {
  emailInput: 'input[name="email"]',
  passwordInput: 'input[name="password"]',
  submitButton: 'button[type="submit"]',
  fieldError: '.text-error',
  inputError: '.input-error',
} as const;

/**
 * Selectors for the TOTP setup page (/setup/totp).
 */
export const totpSetupPage = {
  loadingSpinner: '.loading.loading-spinner',
  qrCodeImage: 'img[alt="TOTP QR Code"]',
  nextButton: '.btn.btn-primary.btn-block',
  pinInput: 'input[inputMode="numeric"]',
  submitButton: 'button[type="submit"]',
  recoveryCodesGrid: '.grid.grid-cols-2',
  confirmCheckbox: 'input[type="checkbox"].checkbox',
  confirmButton: '.btn.btn-primary.btn-block',
  backButton: '.btn.btn-ghost.btn-xs',
} as const;

/**
 * Selectors for the TOTP verify page (/verify/totp).
 */
export const totpVerifyPage = {
  pinInput: 'input[inputMode="numeric"]',
  submitButton: 'button[type="submit"]',
  fieldError: '.text-error',
  recoveryCodeLink: 'button.link.link-info',
  sessionExpiredAlert: '.alert.alert-warning',
} as const;

/**
 * Selectors for the email verify page (/verify/email).
 */
export const emailVerifyPage = {
  tokenInput: 'input[placeholder]',
  submitButton: 'button[type="submit"]',
  resendButton: 'button.btn.btn-ghost.btn-sm',
  successAlert: '.alert-success',
  goToProfileButton: 'button.btn.btn-block',
  fieldError: '.text-error',
} as const;

/**
 * Performs a complete login flow: navigates from the method
 * selection page through the password form and submits credentials.
 */
export async function performLogin(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/login');
  await page.locator(loginMethodPage.passwordMethodLink).click();
  await page.waitForURL('**/login/password');
  await page.locator(loginPasswordPage.emailInput).fill(email);
  await page.locator(loginPasswordPage.passwordInput).fill(password);
  await page.locator(loginPasswordPage.submitButton).click();
}
