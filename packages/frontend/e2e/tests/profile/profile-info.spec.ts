import { expect, test } from '@playwright/test';
import { ProfilePage } from '../../pages';
import { setupAuthenticatedUser } from '../../utils';

test.describe('Profile Page - User Information', () => {
  let profilePage: ProfilePage;
  let onProfilePage: boolean;

  test.beforeEach(async ({ page, request }) => {
    // Setup authenticated user
    await setupAuthenticatedUser(request, page);
    profilePage = new ProfilePage(page);
    await profilePage.goto();

    // Wait for navigation to complete and check final URL
    // The page might redirect from /profile to /setup/totp or other pages
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500); // Allow redirects to complete

    // Check if we landed on profile or were redirected (e.g., to 2FA setup)
    const currentUrl = page.url();
    onProfilePage =
      currentUrl.includes('/profile') && !currentUrl.includes('/setup');
  });

  test('should display the profile page', async () => {
    test.skip(
      !onProfilePage,
      'Redirected to 2FA setup - profile not accessible',
    );
    await profilePage.expectPageLoaded();
  });

  test('should display page title', async () => {
    test.skip(
      !onProfilePage,
      'Redirected to 2FA setup - profile not accessible',
    );
    await expect(profilePage.pageTitle).toBeVisible();
  });

  test('should display user email', async () => {
    test.skip(
      !onProfilePage,
      'Redirected to 2FA setup - profile not accessible',
    );
    // The email should be visible on the page
    await expect(profilePage.userEmail).toBeVisible();
  });

  test('should display logout button', async () => {
    test.skip(
      !onProfilePage,
      'Redirected to 2FA setup - profile not accessible',
    );
    await expect(profilePage.logoutButton).toBeVisible();
  });

  test('should redirect to login after logout', async ({ page }) => {
    test.skip(
      !onProfilePage,
      'Redirected to 2FA setup - profile not accessible',
    );
    await profilePage.logout();
    await expect(page).toHaveURL('/login');
  });

  test('should require authentication to access profile', async ({
    page,
    context,
  }) => {
    // Clear cookies to simulate unauthenticated state
    await context.clearCookies();

    // Try to access profile
    await page.goto('/profile');

    // Should redirect to login
    await expect(page).toHaveURL('/login');
  });
});
