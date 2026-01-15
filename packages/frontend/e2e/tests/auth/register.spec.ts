import { expect, test } from '@playwright/test';
import { generateUniqueEmail, ROUTES } from '../../fixtures/test-data';
import { ensureLoggedOut } from '../../utils/auth-helpers';

test.describe('Register Page', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedOut(page);
    await page.goto(ROUTES.register);
  });

  test('should display registration form', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /create account/i }),
    ).toBeVisible();
    await expect(page.getByPlaceholder(/hello@example.com/i)).toBeVisible();
    await expect(page.getByPlaceholder(/enter your password/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /create account/i }),
    ).toBeVisible();
  });

  test('should register new user successfully', async ({ page }) => {
    const uniqueEmail = generateUniqueEmail('e2e');

    await page.getByPlaceholder(/hello@example.com/i).fill(uniqueEmail);
    await page.getByPlaceholder(/enter your password/i).fill('Password123!');
    await page.getByRole('button', { name: /create account/i }).click();

    // Should redirect to verify-email or profile depending on config
    await page.waitForURL(/\/(profile|verify-email)/);
  });

  test('should show error when registering with existing email', async ({
    page,
  }) => {
    // Use a known existing email (from test fixtures)
    await page
      .getByPlaceholder(/hello@example.com/i)
      .fill('test-config-user@example.com');
    await page.getByPlaceholder(/enter your password/i).fill('Password123!');
    await page.getByRole('button', { name: /create account/i }).click();

    // Should show error message
    await expect(page.getByText(/email already exists/i)).toBeVisible();
  });

  test('should not submit form with invalid email', async ({ page }) => {
    await page.getByPlaceholder(/hello@example.com/i).fill('invalid-email');
    await page.getByPlaceholder(/enter your password/i).fill('Password123!');
    await page.getByRole('button', { name: /create account/i }).click();

    // Browser HTML5 validation should prevent submission - URL should remain on register page
    await expect(page).toHaveURL(ROUTES.register);
  });

  test('should show validation error for short password', async ({ page }) => {
    await page
      .getByPlaceholder(/hello@example.com/i)
      .fill(generateUniqueEmail());
    await page.getByPlaceholder(/enter your password/i).fill('12345');
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByText(/at least 6 characters/i)).toBeVisible();
  });

  test('should navigate to login page', async ({ page }) => {
    await page.getByRole('link', { name: /sign in/i }).click();
    await expect(page).toHaveURL(ROUTES.login);
  });
});
