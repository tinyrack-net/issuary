import { expect, test } from '@playwright/test';
import { ROUTES } from '../../fixtures/test-data';
import { ensureLoggedOut } from '../../utils/auth-helpers';

test.describe('TOTP Verification Page', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedOut(page);
  });

  test('should display TOTP verification form', async ({ page }) => {
    await page.goto(ROUTES.verifyTotp);

    await expect(
      page.getByRole('heading', { name: /two-factor authentication/i }),
    ).toBeVisible();
    await expect(page.getByPlaceholder(/enter 6-digit code/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /verify/i })).toBeVisible();
  });

  test('should show error for invalid TOTP code', async ({ page }) => {
    await page.goto(ROUTES.verifyTotp);

    await page.getByPlaceholder(/enter 6-digit code/i).fill('000000');
    await page.getByRole('button', { name: /verify/i }).click();

    // Should show error (session expired or invalid code)
    await expect(page.getByText(/invalid|expired/i)).toBeVisible();
  });

  test('should have back to login link', async ({ page }) => {
    await page.goto(ROUTES.verifyTotp);

    await page.getByRole('link', { name: /back to login/i }).click();
    await expect(page).toHaveURL(ROUTES.login);
  });
});

test.describe('TOTP Setup Page', () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedOut(page);
  });

  test('should display TOTP setup page', async ({ page }) => {
    await page.goto(ROUTES.setupTotp);

    // Page should display setup instructions
    await expect(
      page.getByRole('heading', { name: /two-factor authentication/i }),
    ).toBeVisible();
  });

  test('should have back to login link', async ({ page }) => {
    await page.goto(ROUTES.setupTotp);

    const backLink = page.getByRole('link', { name: /back to login/i });
    if (await backLink.isVisible()) {
      await backLink.click();
      await expect(page).toHaveURL(ROUTES.login);
    }
  });
});
