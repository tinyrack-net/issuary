import {
  expect,
  test,
} from '@frontend-e2e/fixtures/terms-complete-registration.js';

test.describe('Terms complete registration mode', () => {
  test('normal terms route redirects unauthenticated user to login', async ({
    page,
  }) => {
    await page.goto('/terms');
    await page.waitForURL('**/login');
    await expect(page).toHaveURL(/\/login/);
  });

  test('complete registration mode is accessible without login', async ({
    page,
  }) => {
    await page.goto(
      '/terms?mode=complete_registration&registration_token=invalid-token',
    );

    await expect(page).toHaveURL(/\/terms/);
    await expect(page.getByRole('heading', { name: 'Terms' })).toBeVisible();
    await expect(page.locator('input[type="checkbox"].checkbox')).toHaveCount(
      3,
    );
  });

  test('invalid registration token shows submit error on consent', async ({
    page,
  }) => {
    await page.goto(
      '/terms?mode=complete_registration&registration_token=invalid-token',
    );

    const checkboxes = page.locator('input[type="checkbox"].checkbox');
    await checkboxes.nth(1).check();

    await page.locator('button[type="submit"]').click();

    await expect(
      page.getByText('Failed to submit consent. Please try again.'),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/terms/);
  });
});
