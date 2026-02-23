import type { Page } from '@playwright/test';

/**
 * Selectors for the registration page (/register).
 */
export const registerPage = {
  emailInput: 'input[name="email"]',
  passwordInput: 'input[name="password"]',
  submitButton: 'button[type="submit"]',
  fieldError: '[data-testid="field-error"], [data-testid="terms-field-error"]',
  loginLink: 'a[href^="/login"]',
  termsCheckbox: '[data-testid="terms-checkbox"]',
  requiredBadge: '[data-testid="terms-badge-required"]',
  optionalBadge: '[data-testid="terms-badge-optional"]',
  implicitNotice: '[data-testid="terms-implicit-notice"]',
} as const;

/**
 * Performs a registration flow: navigates to /register, fills the form,
 * and clicks submit.
 */
export async function performRegister(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/register');
  await page.locator(registerPage.emailInput).fill(email);
  await page.locator(registerPage.passwordInput).fill(password);
  await page.locator(registerPage.submitButton).click();
}
