import { test, expect } from '@playwright/test';
import { PasswordForgotPage } from '../../pages';
import { generateEmail, testData } from '../../fixtures';
import { createApiHelpers } from '../../utils';

test.describe('Forgot Password Page', () => {
  let forgotPasswordPage: PasswordForgotPage;

  test.beforeEach(async ({ page }) => {
    forgotPasswordPage = new PasswordForgotPage(page);
    await forgotPasswordPage.goto();
  });

  test('should display the forgot password form', async () => {
    await forgotPasswordPage.expectPageLoaded();
  });

  test('should have email input', async () => {
    await expect(forgotPasswordPage.emailInput).toBeVisible();
  });

  test('should have submit button', async () => {
    await expect(forgotPasswordPage.submitButton).toBeVisible();
  });

  test('should have back to login link', async () => {
    await expect(forgotPasswordPage.loginLink).toBeVisible();
  });

  test('should navigate to login page', async ({ page }) => {
    await forgotPasswordPage.loginLink.click();
    await expect(page).toHaveURL('/login');
  });

  test('should show error for empty email', async () => {
    await forgotPasswordPage.submit();
    await forgotPasswordPage.expectError();
  });

  test('should show error for invalid email format', async () => {
    for (const invalidEmail of testData.invalidEmails) {
      if (invalidEmail) {
        // Skip empty string test as it's covered above
        await forgotPasswordPage.fillEmail(invalidEmail);
        await forgotPasswordPage.submit();
        await forgotPasswordPage.expectError();
        await forgotPasswordPage.emailInput.clear();
      }
    }
  });

  test('should show success message after submitting valid email', async ({ request }) => {
    // Create a user first
    const api = createApiHelpers(request);
    const email = generateEmail();
    const password = 'TestPassword123!';
    await api.register(email, password);

    // Request password reset
    await forgotPasswordPage.requestReset(email);

    // Should show success message
    await forgotPasswordPage.expectSuccess();
  });

  test('should show success message even for non-existent email', async () => {
    // For security, the API should not reveal if email exists
    const nonExistentEmail = `nonexistent-${Date.now()}@e2e.test`;
    await forgotPasswordPage.requestReset(nonExistentEmail);

    // Should still show success message (for security)
    await forgotPasswordPage.expectSuccess();
  });

  test('should show check spam info after success', async ({ request }) => {
    const api = createApiHelpers(request);
    const email = generateEmail();
    const password = 'TestPassword123!';
    await api.register(email, password);

    await forgotPasswordPage.requestReset(email);
    await forgotPasswordPage.expectSuccess();
    await forgotPasswordPage.expectCheckSpamInfo();
  });

  test('should show back to login button after success', async ({ request }) => {
    const api = createApiHelpers(request);
    const email = generateEmail();
    const password = 'TestPassword123!';
    await api.register(email, password);

    await forgotPasswordPage.requestReset(email);
    await forgotPasswordPage.expectSuccess();
    await expect(forgotPasswordPage.backToLoginButton).toBeVisible();
  });

  test('should navigate to login from success state', async ({ page, request }) => {
    const api = createApiHelpers(request);
    const email = generateEmail();
    const password = 'TestPassword123!';
    await api.register(email, password);

    await forgotPasswordPage.requestReset(email);
    await forgotPasswordPage.expectSuccess();
    await forgotPasswordPage.clickBackToLogin();
    await expect(page).toHaveURL('/login');
  });
});
