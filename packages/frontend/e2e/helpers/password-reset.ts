import { getTestApiClient } from '#frontend-e2e/setup/api-client.js';

/**
 * Selectors for the forgot password page (/password/forgot).
 */
export const forgotPasswordPage = {
  emailInput: 'input[type="email"]',
  submitButton: 'button[type="submit"]',
  successAlert: '[data-testid="alert-success"]',
  backToLoginLink: 'a[href="/login"]',
  fieldError: '[data-testid="field-error"]',
} as const;

/**
 * Selectors for the reset password page (/password/reset).
 */
export const resetPasswordPage = {
  tokenInput: 'input[name="token"]',
  passwordInput: 'input[name="password"]',
  confirmPasswordInput: 'input[name="confirmPassword"]',
  submitButton: 'button[type="submit"]',
  successAlert: '[data-testid="alert-success"]',
  goToLoginButton: '[data-testid="reset-password-go-login"]',
  tokenError: '[data-testid="reset-password-token-error"]',
  fieldError: '[data-testid="field-error"]',
  backToLoginLink: '[data-testid="reset-password-back-to-login"]',
} as const;

/**
 * Fetches the password reset token for a user via the test endpoint.
 */
export async function getPasswordResetToken(
  baseURL: string,
  email: string,
): Promise<string> {
  const client = getTestApiClient({ baseUrl: baseURL });
  const res = await client.test['password-reset-token'][':email'].$get({
    param: { email },
  });
  if (!res.ok) {
    throw new Error(`Failed to get password reset token: ${res.status}`);
  }
  const data = await res.json();
  return data.token;
}
