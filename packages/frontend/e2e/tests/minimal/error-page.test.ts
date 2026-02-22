import { expect, test } from '@playwright/test';

test.describe('Error page', () => {
  test('displays code and message from URL params', async ({ page }) => {
    await page.goto(
      '/error?code=TEST_ERROR&message=A+custom+error+has+occurred',
    );

    // Error code should be displayed in the code element
    await expect(page.locator('code')).toContainText('TEST_ERROR');

    // Custom error message should be displayed
    await expect(page.getByText('A custom error has occurred')).toBeVisible();
  });

  test('shows default values when no params are provided', async ({ page }) => {
    await page.goto('/error');

    // Default error code should be shown
    await expect(page.locator('code')).toContainText('UNKNOWN_ERROR');
  });

  test('"Go to login" link navigates to /login', async ({ page }) => {
    await page.goto('/error');

    // Click "Go to login" link
    await page.getByRole('link', { name: 'Go to login' }).click();

    await page.waitForURL('**/login');
    await expect(page).toHaveURL(/\/login/);
  });
});
