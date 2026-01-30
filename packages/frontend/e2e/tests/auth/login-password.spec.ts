import { expect, test } from '@playwright/test';
import { generateEmail, generatePassword, testData } from '../../fixtures';
import { LoginPasswordPage } from '../../pages';
import { createApiHelpers } from '../../utils';

test.describe('Password Login Page', () => {
  let loginPasswordPage: LoginPasswordPage;

  test.beforeEach(async ({ page }) => {
    loginPasswordPage = new LoginPasswordPage(page);
    await loginPasswordPage.goto();
  });

  test('should display the login form', async () => {
    await loginPasswordPage.expectPageLoaded();
  });

  test('should have email and password inputs', async () => {
    await expect(loginPasswordPage.emailInput).toBeVisible();
    await expect(loginPasswordPage.passwordInput).toBeVisible();
  });

  test('should have submit button', async () => {
    await expect(loginPasswordPage.submitButton).toBeVisible();
  });

  test('should have forgot password link', async () => {
    await expect(loginPasswordPage.forgotPasswordLink).toBeVisible();
  });

  test('should have register link', async () => {
    await expect(loginPasswordPage.registerLink).toBeVisible();
  });

  test('should navigate to forgot password page', async ({ page }) => {
    await loginPasswordPage.clickForgotPassword();
    await expect(page).toHaveURL('/password/forgot');
  });

  test('should navigate to register page', async ({ page }) => {
    await loginPasswordPage.clickRegister();
    await expect(page).toHaveURL('/register');
  });

  test('should show error for empty email', async () => {
    await loginPasswordPage.fillPassword(testData.validUser.password);
    await loginPasswordPage.submit();
    await loginPasswordPage.expectError();
  });

  test('should show error for empty password', async () => {
    await loginPasswordPage.fillEmail(testData.validUser.email);
    await loginPasswordPage.submit();
    await loginPasswordPage.expectError();
  });

  test('should show error for invalid email format', async () => {
    await loginPasswordPage.fillEmail('invalid-email');
    await loginPasswordPage.fillPassword(testData.validUser.password);
    await loginPasswordPage.submit();
    await loginPasswordPage.expectError();
  });

  test('should show error for invalid credentials', async () => {
    await loginPasswordPage.login(
      testData.invalidCredentials.email,
      testData.invalidCredentials.password,
    );
    await loginPasswordPage.expectError();
  });

  test('should successfully login with valid credentials', async ({
    page,
    request,
  }) => {
    // Create a test user via API
    const api = createApiHelpers(request);
    const email = generateEmail();
    const password = generatePassword();
    await api.register(email, password);

    // Login through UI
    await loginPasswordPage.login(email, password);

    // Should redirect to profile, verification, or 2FA setup page
    await expect(page).toHaveURL(
      /\/(profile|verify|setup\/(totp|2fa|passkey))/,
    );
  });

  test('should redirect to profile after successful login', async ({
    page,
    request,
  }) => {
    // Create a test user via API
    const api = createApiHelpers(request);
    const email = generateEmail();
    const password = generatePassword();
    await api.register(email, password);

    // Login through UI
    await loginPasswordPage.login(email, password);

    // Wait for navigation (may go to profile, verify, or 2FA setup)
    await page.waitForURL(/\/(profile|verify|setup\/(totp|2fa|passkey))/, {
      timeout: 10000,
    });

    // Check that we're on a protected page
    const url = page.url();
    expect(url).toMatch(/\/(profile|verify|setup\/(totp|2fa|passkey))/);
  });
});
