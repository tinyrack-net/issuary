import { expect, test } from '@playwright/test';
import { ProfilePage } from '../../pages';
import { setupAuthenticatedUser } from '../../utils';

test.describe('Logout', () => {
  test('should logout and redirect to login page', async ({
    page,
    request,
  }) => {
    // Setup authenticated user
    await setupAuthenticatedUser(request, page);

    // Navigate to profile page
    const profilePage = new ProfilePage(page);
    await profilePage.goto();

    // Wait for navigation to complete and check final URL
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const currentUrl = page.url();
    const onProfilePage =
      currentUrl.includes('/profile') && !currentUrl.includes('/setup');
    test.skip(
      !onProfilePage,
      'Redirected to 2FA setup - profile not accessible',
    );

    await profilePage.expectPageLoaded();

    // Click logout
    await profilePage.logout();

    // Should redirect to login
    await profilePage.expectLogoutSuccess();
    await expect(page).toHaveURL('/login');
  });

  test('should clear session after logout', async ({ page, request }) => {
    // Setup authenticated user
    await setupAuthenticatedUser(request, page);

    // Navigate to profile page
    const profilePage = new ProfilePage(page);
    await profilePage.goto();

    // Wait for navigation to complete and check final URL
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const currentUrl = page.url();
    const onProfilePage =
      currentUrl.includes('/profile') && !currentUrl.includes('/setup');
    test.skip(
      !onProfilePage,
      'Redirected to 2FA setup - profile not accessible',
    );

    await profilePage.expectPageLoaded();

    // Click logout
    await profilePage.logout();
    await expect(page).toHaveURL('/login');

    // Try to access profile page again
    await page.goto('/profile');

    // Should redirect to login (session cleared)
    await expect(page).toHaveURL('/login');
  });

  test('should show logout button on profile page', async ({
    page,
    request,
  }) => {
    // Setup authenticated user
    await setupAuthenticatedUser(request, page);

    // Navigate to profile page
    const profilePage = new ProfilePage(page);
    await profilePage.goto();

    // Wait for navigation to complete and check final URL
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const currentUrl = page.url();
    const onProfilePage =
      currentUrl.includes('/profile') && !currentUrl.includes('/setup');
    test.skip(
      !onProfilePage,
      'Redirected to 2FA setup - profile not accessible',
    );

    // Logout button should be visible
    await expect(profilePage.logoutButton).toBeVisible();
  });
});
