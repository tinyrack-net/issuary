import { expect, test } from '@playwright/test';
import { ROUTES } from '../../fixtures/test-data';
import { ensureLoggedOut } from '../../utils/auth-helpers';

test.describe('Email Verification Page', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedOut(page);
  });

  test('should display email verification form', async ({ page }) => {
    await page.goto(`${ROUTES.verifyEmail}?email=test@example.com&token=`);

    await expect(
      page.getByRole('heading', { name: /email verification/i }),
    ).toBeVisible();
    await expect(page.getByPlaceholder(/enter the token/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /verify/i })).toBeVisible();
  });

  test('should show error for invalid verification token', async ({ page }) => {
    await page.goto(`${ROUTES.verifyEmail}?email=test@example.com&token=`);

    await page.getByPlaceholder(/enter the token/i).fill('invalid-token');
    await page.getByRole('button', { name: /verify/i }).click();

    // Should show error
    await expect(page.getByText(/invalid|expired/i)).toBeVisible();
  });

  test('should have resend verification email button', async ({ page }) => {
    await page.goto(`${ROUTES.verifyEmail}?email=test@example.com&token=`);

    const resendButton = page.getByRole('button', {
      name: /resend verification email/i,
    });
    await expect(resendButton).toBeVisible();
  });

  test('should handle auto-verification with token in URL', async ({
    page,
  }) => {
    // Navigate with a token in URL (simulating clicking email link)
    await page.goto(
      `${ROUTES.verifyEmail}?email=test@example.com&token=test-token`,
    );

    // The token field should be pre-filled
    const tokenInput = page.getByPlaceholder(/enter the token/i);
    await expect(tokenInput).toHaveValue('test-token');
  });
});
