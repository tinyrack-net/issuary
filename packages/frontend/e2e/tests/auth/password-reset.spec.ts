import { expect, test } from '@playwright/test';
import { ROUTES } from '../../fixtures/test-data';
import { ensureLoggedOut } from '../../utils/auth-helpers';

test.describe('Forgot Password Page', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedOut(page);
    await page.goto(ROUTES.forgotPassword);
  });

  test('should display forgot password form', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /forgot password/i }),
    ).toBeVisible();
    await expect(page.getByPlaceholder(/hello@example.com/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /send reset link/i }),
    ).toBeVisible();
  });

  test('should submit password reset request', async ({ page }) => {
    await page.getByPlaceholder(/hello@example.com/i).fill('test@example.com');
    await page.getByRole('button', { name: /send reset link/i }).click();

    // Should show success message (even for non-existent emails for security)
    await expect(
      page.getByRole('heading', { name: /check your inbox/i }),
    ).toBeVisible();
  });

  test('should not submit form with invalid email', async ({ page }) => {
    await page.getByPlaceholder(/hello@example.com/i).fill('invalid-email');
    await page.getByRole('button', { name: /send reset link/i }).click();

    // Browser HTML5 validation should prevent submission - URL should remain on forgot-password page
    await expect(page).toHaveURL(ROUTES.forgotPassword);
  });

  test('should navigate back to login', async ({ page }) => {
    await page.getByRole('link', { name: /back to login|sign in/i }).click();
    await expect(page).toHaveURL(ROUTES.login);
  });
});

test.describe('Reset Password Page', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedOut(page);
  });

  test('should display reset password form with token', async ({ page }) => {
    await page.goto(`${ROUTES.resetPassword}?token=test-token`);

    await expect(
      page.getByRole('heading', { name: /reset password/i }),
    ).toBeVisible();
    await expect(
      page.getByPlaceholder(/enter your new password/i),
    ).toBeVisible();
    await expect(
      page.getByPlaceholder(/confirm your new password/i),
    ).toBeVisible();
  });

  test('should show validation error for password mismatch', async ({
    page,
  }) => {
    await page.goto(`${ROUTES.resetPassword}?token=test-token`);

    await page
      .getByPlaceholder(/enter your new password/i)
      .fill('Password123!');
    await page
      .getByPlaceholder(/confirm your new password/i)
      .fill('DifferentPassword!');
    await page.getByRole('button', { name: /reset password/i }).click();

    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });

  test('should show error for invalid token', async ({ page }) => {
    await page.goto(`${ROUTES.resetPassword}?token=invalid-token`);

    await page
      .getByPlaceholder(/enter your new password/i)
      .fill('Password123!');
    await page
      .getByPlaceholder(/confirm your new password/i)
      .fill('Password123!');
    await page.getByRole('button', { name: /reset password/i }).click();

    // Should show error about invalid token
    await expect(page.getByText(/invalid|expired/i)).toBeVisible();
  });
});
