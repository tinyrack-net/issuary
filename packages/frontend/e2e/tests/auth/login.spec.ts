import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages';

test.describe('Login Page', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('should display the login page with title', async () => {
    await loginPage.expectPageLoaded();
    await expect(loginPage.pageTitle).toBeVisible();
  });

  test('should display password login method button', async () => {
    await loginPage.expectPasswordMethodVisible();
  });

  test('should navigate to password login page when clicking password method', async ({ page }) => {
    await loginPage.clickPasswordMethod();
    await expect(page).toHaveURL('/login/password');
  });

  test('should redirect from root to login page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });
});
