import { expect, test } from '@playwright/test';
import { ensureLoggedOut, login } from '../../utils/auth-helpers';

test.describe('Profile - Password Management', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedOut(page);
    await login(page);
    await page.waitForURL(/\/profile/);
  });

  test('should display password section', async ({ page }) => {
    // Password section title text (use exact match to avoid matching other elements)
    await expect(page.getByText('Password', { exact: true })).toBeVisible();
  });

  test('should show password status', async ({ page }) => {
    // Should show either "Password is set" or "No password set"
    const passwordStatus = page.getByText(/password is set|no password set/i);
    await expect(passwordStatus).toBeVisible();
  });

  test('should show change password button when password is set', async ({
    page,
  }) => {
    const changeButton = page.getByRole('button', {
      name: /change password/i,
    });

    // Check if the button exists (password is set)
    if (await changeButton.isVisible()) {
      await changeButton.click();

      // Modal should open - check for modal dialog
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/change password/i).first()).toBeVisible();
    }
  });

  test('should validate current password in change modal', async ({ page }) => {
    const changeButton = page.getByRole('button', {
      name: /change password/i,
    });

    if (await changeButton.isVisible()) {
      await changeButton.click();

      // Fill form with wrong current password
      await page
        .getByPlaceholder(/enter current password/i)
        .fill('wrongpassword');
      await page
        .getByPlaceholder(/enter new password/i)
        .fill('NewPassword123!');
      await page
        .getByPlaceholder(/confirm new password/i)
        .fill('NewPassword123!');

      // Submit
      const submitButton = page
        .getByRole('dialog')
        .getByRole('button', { name: /change password/i });
      await submitButton.click();

      // Should show error
      await expect(page.getByText(/incorrect|invalid/i)).toBeVisible();
    }
  });
});
