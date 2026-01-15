import { expect, test } from '@playwright/test';
import { ROUTES, TEST_USER } from '../../fixtures/test-data';
import { ensureLoggedOut } from '../../utils/auth-helpers';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedOut(page);
    await page.goto(ROUTES.login);
  });

  test('should display login form', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /welcome back/i }),
    ).toBeVisible();
    await expect(page.getByPlaceholder(/hello@example.com/i)).toBeVisible();
    await expect(page.getByPlaceholder(/enter your password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /log in/i })).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.getByPlaceholder(/hello@example.com/i).fill(TEST_USER.email);
    await page
      .getByPlaceholder(/enter your password/i)
      .fill(TEST_USER.password);
    await page.getByRole('button', { name: /log in/i }).click();

    // Should redirect to profile page
    await expect(page).toHaveURL(ROUTES.profile);
    await expect(
      page.getByRole('heading', { name: /my profile/i }),
    ).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.getByPlaceholder(/hello@example.com/i).fill(TEST_USER.email);
    await page.getByPlaceholder(/enter your password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /log in/i }).click();

    // Should show error message
    await expect(page.getByText(/login failed/i)).toBeVisible();
    // Should stay on login page
    await expect(page).toHaveURL(ROUTES.login);
  });

  test('should show error with non-existent email', async ({ page }) => {
    await page
      .getByPlaceholder(/hello@example.com/i)
      .fill('nonexistent@example.com');
    await page.getByPlaceholder(/enter your password/i).fill('anypassword');
    await page.getByRole('button', { name: /log in/i }).click();

    // Should show error message
    await expect(page.getByText(/login failed/i)).toBeVisible();
  });

  test('should show validation error for invalid email format', async ({
    page,
  }) => {
    await page.getByPlaceholder(/hello@example.com/i).fill('invalid-email');
    await page.getByPlaceholder(/enter your password/i).fill('password');
    await page.getByRole('button', { name: /log in/i }).click();

    // Should stay on login page (form validation prevented submission)
    await expect(page).toHaveURL(ROUTES.login);
  });

  test('should show validation error for empty password', async ({ page }) => {
    await page.getByPlaceholder(/hello@example.com/i).fill(TEST_USER.email);
    await page.getByRole('button', { name: /log in/i }).click();

    // Should show validation error
    await expect(page.getByText(/please enter your password/i)).toBeVisible();
  });

  test('should navigate to register page', async ({ page }) => {
    await page.getByRole('link', { name: /sign up/i }).click();
    await expect(page).toHaveURL(ROUTES.register);
  });

  test('should navigate to forgot password page', async ({ page }) => {
    await page.getByRole('link', { name: /forgot password/i }).click();
    await expect(page).toHaveURL(ROUTES.forgotPassword);
  });
});
