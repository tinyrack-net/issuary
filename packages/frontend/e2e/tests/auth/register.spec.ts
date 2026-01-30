import { expect, test } from '@playwright/test';
import {
  generateEmail,
  generatePassword,
  generateWeakPassword,
  testData,
} from '../../fixtures';
import { RegisterPage } from '../../pages';

test.describe('Register Page', () => {
  let registerPage: RegisterPage;

  test.beforeEach(async ({ page }) => {
    registerPage = new RegisterPage(page);
    await registerPage.goto();
  });

  test('should display the registration form', async () => {
    await registerPage.expectPageLoaded();
  });

  test('should have email and password inputs', async () => {
    await expect(registerPage.emailInput).toBeVisible();
    await expect(registerPage.passwordInput).toBeVisible();
  });

  test('should have submit button', async () => {
    await expect(registerPage.submitButton).toBeVisible();
  });

  test('should have login link', async () => {
    await expect(registerPage.loginLink).toBeVisible();
  });

  test('should navigate to login page', async ({ page }) => {
    await registerPage.clickLogin();
    await expect(page).toHaveURL('/login');
  });

  test('should show error for empty email', async () => {
    await registerPage.fillPassword(generatePassword());
    await registerPage.submit();
    await registerPage.expectError();
  });

  test('should show error for empty password', async () => {
    await registerPage.fillEmail(generateEmail());
    await registerPage.submit();
    await registerPage.expectError();
  });

  test('should show error for invalid email format', async () => {
    for (const invalidEmail of testData.invalidEmails) {
      await registerPage.fillEmail(invalidEmail);
      await registerPage.fillPassword(generatePassword());
      await registerPage.submit();
      await registerPage.expectError();
      // Clear for next iteration
      await registerPage.emailInput.clear();
      await registerPage.passwordInput.clear();
    }
  });

  test('should show error for weak password', async () => {
    await registerPage.fillEmail(generateEmail());
    await registerPage.fillPassword(generateWeakPassword());
    await registerPage.submit();
    await registerPage.expectError();
  });

  test('should successfully register with valid credentials', async ({
    page,
  }) => {
    const email = generateEmail();
    const password = generatePassword();

    await registerPage.register(email, password);

    // Should redirect to email verification, 2FA setup, or profile page
    // Depending on backend configuration
    await page.waitForURL(
      /\/(verify\/email|setup\/(totp|2fa|passkey)|profile)/,
      { timeout: 10000 },
    );
    const url = page.url();
    expect(url).toMatch(/\/(verify\/email|setup\/(totp|2fa|passkey)|profile)/);
  });

  test('should show error when registering with existing email', async ({
    page,
  }) => {
    const email = generateEmail();
    const password = generatePassword();

    // First registration
    await registerPage.register(email, password);
    await page.waitForURL(
      /\/(verify\/email|setup\/(totp|2fa|passkey)|profile)/,
      { timeout: 10000 },
    );

    // Try to register again with same email
    await registerPage.goto();
    await registerPage.register(email, password);
    await registerPage.expectError();
  });
});
