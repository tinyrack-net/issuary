import { expect, test } from '@playwright/test';
import {
  generatePassword,
  generateWeakPassword,
  testData,
} from '../../fixtures';
import { PasswordResetPage } from '../../pages';

test.describe('Password Reset Page', () => {
  let resetPasswordPage: PasswordResetPage;

  test.beforeEach(async ({ page }) => {
    resetPasswordPage = new PasswordResetPage(page);
  });

  test('should display the password reset form', async () => {
    await resetPasswordPage.goto();
    await resetPasswordPage.expectPageLoaded();
  });

  test('should have password inputs', async () => {
    await resetPasswordPage.goto();
    await expect(resetPasswordPage.passwordInput).toBeVisible();
    await expect(resetPasswordPage.confirmPasswordInput).toBeVisible();
  });

  test('should have submit button', async () => {
    await resetPasswordPage.goto();
    await expect(resetPasswordPage.submitButton).toBeVisible();
  });

  test('should have back to login link', async () => {
    await resetPasswordPage.goto();
    await expect(resetPasswordPage.backToLoginLink).toBeVisible();
  });

  test('should show token input when no token in URL', async () => {
    await resetPasswordPage.goto();
    await resetPasswordPage.expectTokenInputVisible();
  });

  test('should hide token input when token is in URL', async () => {
    await resetPasswordPage.goto('some-token-123');
    await resetPasswordPage.expectTokenInputHidden();
  });

  test('should navigate to login page', async ({ page }) => {
    await resetPasswordPage.goto();
    await resetPasswordPage.clickBackToLogin();
    await expect(page).toHaveURL('/login');
  });

  test('should show error for empty password', async () => {
    await resetPasswordPage.goto();
    await resetPasswordPage.fillToken('test-token');
    await resetPasswordPage.fillConfirmPassword(generatePassword());
    await resetPasswordPage.submit();
    await resetPasswordPage.expectError();
  });

  test('should show error for empty confirm password', async () => {
    await resetPasswordPage.goto();
    await resetPasswordPage.fillToken('test-token');
    await resetPasswordPage.fillPassword(generatePassword());
    await resetPasswordPage.submit();
    await resetPasswordPage.expectError();
  });

  test('should show error for password mismatch', async () => {
    await resetPasswordPage.goto();
    await resetPasswordPage.fillToken('test-token');
    await resetPasswordPage.fillPassword('Password123!');
    await resetPasswordPage.fillConfirmPassword('DifferentPassword123!');
    await resetPasswordPage.submit();
    await resetPasswordPage.expectError();
  });

  test('should show error for weak password', async () => {
    await resetPasswordPage.goto();
    await resetPasswordPage.fillToken('test-token');
    const weakPassword = generateWeakPassword();
    await resetPasswordPage.fillPassword(weakPassword);
    await resetPasswordPage.fillConfirmPassword(weakPassword);
    await resetPasswordPage.submit();
    await resetPasswordPage.expectError();
  });

  test('should show error for invalid token', async () => {
    await resetPasswordPage.goto();
    const password = generatePassword();
    await resetPasswordPage.resetPassword(
      password,
      password,
      testData.tokens.invalid,
    );
    await resetPasswordPage.expectTokenError();
  });

  test('should show error for invalid token from URL parameter', async () => {
    await resetPasswordPage.goto('invalid-token-123');
    const password = generatePassword();
    await resetPasswordPage.fillPassword(password);
    await resetPasswordPage.fillConfirmPassword(password);
    await resetPasswordPage.submit();
    await resetPasswordPage.expectTokenError();
  });

  test('should show error for empty token', async () => {
    await resetPasswordPage.goto();
    const password = generatePassword();
    await resetPasswordPage.fillPassword(password);
    await resetPasswordPage.fillConfirmPassword(password);
    await resetPasswordPage.submit();
    await resetPasswordPage.expectError();
  });

  // Note: Testing successful password reset requires a valid token
  // which would need integration with email service or a test endpoint
  test.skip('should successfully reset password with valid token', async () => {
    // This test would require:
    // 1. Creating a user
    // 2. Requesting password reset
    // 3. Obtaining the token (from email or test endpoint)
    // 4. Using the token to reset password
    // 5. Logging in with new password
  });
});
