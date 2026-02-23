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
  fieldError: '[data-testid="field-error"]',
  inputError: '[data-testid="input-error-wrapper"]',
} as const;

/**
 * Selectors for the TOTP setup page (/setup/totp).
 */
export const totpSetupPage = {
  loadingSpinner: '[data-testid="totp-setup-loading"]',
  qrCodeImage: 'img[alt="TOTP QR Code"]',
  nextButton: '[data-testid="totp-qr-next"]',
  pinInput: 'input[inputMode="numeric"]',
  submitButton: 'button[type="submit"]',
  recoveryCodesGrid: '[data-testid="recovery-codes-grid"]',
  confirmCheckbox: '[data-testid="recovery-codes-confirm"]',
  confirmButton: '[data-testid="recovery-codes-submit"]',
  backButton: '[data-testid="totp-verify-back"]',
} as const;

/**
 * Selectors for the TOTP verify page (/verify/totp).
 */
export const totpVerifyPage = {
  pinInput: 'input[inputMode="numeric"]',
  submitButton: 'button[type="submit"]',
  fieldError: '[data-testid="pin-input-error"]',
  recoveryCodeLink: '[data-testid="totp-verify-recovery-link"]',
  sessionExpiredAlert: '[data-testid="totp-verify-session-expired"]',
} as const;

/**
 * Selectors for the email verify page (/verify/email).
 */
export const emailVerifyPage = {
  tokenInput: 'input[name="token"]',
  submitButton: 'button[type="submit"]',
  resendButton: '[data-testid="email-verify-resend"]',
  successAlert: '[data-testid="alert-success"]',
  goToProfileButton: '[data-testid="email-verify-go-profile"]',
  fieldError: '[data-testid="field-error"]',
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
