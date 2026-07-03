import { expect, type Page } from '@playwright/test';

function isNavigationAbort(error: unknown): boolean {
  const message = String(error instanceof Error ? error.message : error);
  return (
    message.includes('NS_BINDING_ABORTED') ||
    message.includes('NS_ERROR_FAILURE')
  );
}

async function gotoLogin(page: Page): Promise<void> {
  const options = { waitUntil: 'domcontentloaded' as const };
  try {
    await page.goto('/login', options);
    return;
  } catch (error) {
    if (!isNavigationAbort(error)) {
      throw error;
    }
  }

  await page
    .waitForLoadState('domcontentloaded', { timeout: 5_000 })
    .catch(() => undefined);

  try {
    await page.goto('/login', options);
  } catch (error) {
    if (!isNavigationAbort(error)) {
      throw error;
    }
    await page
      .waitForLoadState('domcontentloaded', { timeout: 5_000 })
      .catch(() => undefined);
  }
}

/**
 * Selectors for the login method selection page (/login).
 */
export const loginMethodPage = {
  passwordMethodLink: 'a[href^="/login/password"]',
  passkeyMethodButton: 'button:has-text("Passkey")',
} as const;

export const LOGIN_METHOD_PAGE_TIMEOUT_MS = 30_000;

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

export async function expectLoginMethodPage(page: Page): Promise<void> {
  await expect(page.locator(loginMethodPage.passwordMethodLink)).toBeVisible({
    timeout: LOGIN_METHOD_PAGE_TIMEOUT_MS,
  });
}

export async function expectPasswordLoginForm(page: Page): Promise<void> {
  await expect(page.locator(loginPasswordPage.emailInput)).toBeVisible({
    timeout: LOGIN_METHOD_PAGE_TIMEOUT_MS,
  });
}

/**
 * Moves from the current login entry point to the password form.
 * Password-only configs redirect from /login directly to /login/password,
 * while multi-method configs still require selecting the password method.
 */
export async function openPasswordLoginFromCurrentPage(
  page: Page,
): Promise<void> {
  const passwordForm = page.locator(loginPasswordPage.emailInput);
  const passwordMethodLink = page.locator(loginMethodPage.passwordMethodLink);

  for (
    let attempt = 0;
    attempt < LOGIN_METHOD_PAGE_TIMEOUT_MS / 100;
    attempt += 1
  ) {
    if (await passwordForm.isVisible()) {
      return;
    }

    if (await passwordMethodLink.isVisible()) {
      await passwordMethodLink.click();
      await page.waitForURL('**/login/password**');
      return;
    }

    await page.waitForTimeout(100);
  }

  await expectPasswordLoginForm(page);
}

/**
 * Performs a complete login flow through the password form.
 */
export async function performLogin(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await gotoLogin(page);
  await openPasswordLoginFromCurrentPage(page);
  await page.locator(loginPasswordPage.emailInput).fill(email);
  await page.locator(loginPasswordPage.passwordInput).fill(password);
  await page.locator(loginPasswordPage.submitButton).click();
}
