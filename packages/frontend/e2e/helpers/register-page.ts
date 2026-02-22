import type { Page } from '@playwright/test';

/**
 * Selectors for the registration page (/register).
 */
export const registerPage = {
  emailInput: 'input[name="email"]',
  passwordInput: 'input[name="password"]',
  submitButton: 'button[type="submit"]',
  fieldError: '.text-error',
  loginLink: 'a[href^="/login"]',
  termsCheckbox: 'input[type="checkbox"].checkbox',
  requiredBadge: '.badge-error',
  optionalBadge: '.badge-ghost',
  implicitNotice: '.prose',
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
