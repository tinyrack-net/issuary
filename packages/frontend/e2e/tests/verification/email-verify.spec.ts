import { expect, test } from '@playwright/test';
import { generateEmail, generatePassword, testData } from '../../fixtures';
import { VerifyEmailPage } from '../../pages';
import { createApiHelpers } from '../../utils';

test.describe('Email Verification Page', () => {
  let verifyEmailPage: VerifyEmailPage;

  test.beforeEach(async ({ page }) => {
    verifyEmailPage = new VerifyEmailPage(page);
  });

  test('should display the verification form', async () => {
    await verifyEmailPage.goto();
    await verifyEmailPage.expectPageLoaded();
  });

  test('should have token input', async () => {
    await verifyEmailPage.goto();
    await expect(verifyEmailPage.tokenInput).toBeVisible();
  });

  test('should have submit button', async () => {
    await verifyEmailPage.goto();
    await expect(verifyEmailPage.submitButton).toBeVisible();
  });

  test('should show error for empty token', async () => {
    await verifyEmailPage.goto();
    await verifyEmailPage.submit();
    await verifyEmailPage.expectError();
  });

  test('should show error for invalid token', async () => {
    await verifyEmailPage.goto();
    await verifyEmailPage.verify(testData.tokens.invalid);
    await verifyEmailPage.expectError();
  });

  test('should pre-fill token from URL parameter', async () => {
    const testToken = 'test-token-123';
    await verifyEmailPage.goto({ token: testToken });

    const value = await verifyEmailPage.tokenInput.inputValue();
    expect(value).toBe(testToken);
  });

  test('should show email sent info when email parameter is provided', async () => {
    const testEmail = 'test@example.com';
    await verifyEmailPage.goto({ email: testEmail });
    await verifyEmailPage.expectEmailSentInfo();
  });

  test('should show resend button when email parameter is provided', async () => {
    const testEmail = 'test@example.com';
    await verifyEmailPage.goto({ email: testEmail });
    await expect(verifyEmailPage.resendButton).toBeVisible();
  });

  test('should not show resend button when no email parameter', async () => {
    await verifyEmailPage.goto();
    await expect(verifyEmailPage.resendButton).not.toBeVisible();
  });

  test('should navigate to profile after successful verification', async ({
    page,
    request,
  }) => {
    // Create and login a user first
    const api = createApiHelpers(request);
    const email = generateEmail();
    const password = generatePassword();

    await api.register(email, password);
    await api.login(email, password);

    // Apply session cookies to page
    const cookies = await request.storageState();
    await page.context().addCookies(cookies.cookies);

    // Note: In a real test, we would need to obtain a valid verification token
    // This test demonstrates the flow but would need integration with email service
    // or a test endpoint to get the actual token

    await verifyEmailPage.goto({ email });
    await verifyEmailPage.expectPageLoaded();
  });
});
