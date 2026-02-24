import {
  expect,
  test,
} from '#frontend-e2e/fixtures/terms-complete-registration.js';
import { registerPage } from '#frontend-e2e/helpers/register-page.js';

const REDIRECT_PARAM =
  '/oauth/authorize?client_id=e2e-test-client-id&state=terms-complete-state';

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
    await expect(page.locator(registerPage.termsCheckbox)).toHaveCount(3);
  });

  test('invalid registration token shows submit error on consent', async ({
    page,
  }) => {
    await page.goto(
      '/terms?mode=complete_registration&registration_token=invalid-token',
    );

    const checkboxes = page.locator(registerPage.termsCheckbox);
    await checkboxes.nth(1).check();

    await page.locator('button[type="submit"]').click();

    await expect(
      page.getByText('Failed to submit consent. Please try again.'),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/terms/);
  });

  test('invalid token keeps redirect context for retry', async ({ page }) => {
    await page.goto(
      `/terms?mode=complete_registration&registration_token=invalid-token&redirect=${encodeURIComponent(REDIRECT_PARAM)}`,
    );

    const checkboxes = page.locator(registerPage.termsCheckbox);
    await checkboxes.nth(1).check();
    await page.locator('button[type="submit"]').click();

    await expect(
      page.getByText('Failed to submit consent. Please try again.'),
    ).toBeVisible();

    const currentUrl = new URL(page.url());
    expect(currentUrl.searchParams.get('mode')).toBe('complete_registration');
    expect(currentUrl.searchParams.get('redirect')).toBe(REDIRECT_PARAM);
  });

  test('missing registration token in complete-registration mode shows error', async ({
    page,
  }) => {
    await page.goto(
      `/terms?mode=complete_registration&redirect=${encodeURIComponent(REDIRECT_PARAM)}`,
    );

    const checkboxes = page.locator(registerPage.termsCheckbox);
    await checkboxes.nth(1).check();
    await page.locator('button[type="submit"]').click();

    await expect(
      page.getByText('Failed to submit consent. Please try again.'),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/terms/);
  });
});
