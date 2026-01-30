import { test, expect } from '@playwright/test';
import { ProfilePage } from '../../pages';
import { setupAuthenticatedUser } from '../../utils';

test.describe('Profile Page - User Information', () => {
  let profilePage: ProfilePage;

  test.beforeEach(async ({ page, request }) => {
    // Setup authenticated user
    await setupAuthenticatedUser(request, page);
    profilePage = new ProfilePage(page);
    await profilePage.goto();
  });

  test('should display the profile page', async () => {
    await profilePage.expectPageLoaded();
  });

  test('should display page title', async () => {
    await expect(profilePage.pageTitle).toBeVisible();
  });

  test('should display user email', async ({ request }) => {
    // Get the test user email from the authenticated session
    const cookies = await request.storageState();
    // The email should be visible on the page
    await expect(profilePage.userEmail).toBeVisible();
  });

  test('should display logout button', async () => {
    await expect(profilePage.logoutButton).toBeVisible();
  });

  test('should redirect to login after logout', async ({ page }) => {
    await profilePage.logout();
    await expect(page).toHaveURL('/login');
  });

  test('should require authentication to access profile', async ({ page, context }) => {
    // Clear cookies to simulate unauthenticated state
    await context.clearCookies();

    // Try to access profile
    await page.goto('/profile');

    // Should redirect to login
    await expect(page).toHaveURL('/login');
  });
});
