import {
  expect,
  test,
} from '@frontend-e2e/fixtures/ui-branding-locale-theme.js';

test.describe('UI config driven rendering', () => {
  test('login page renders branding title subtitle and icon', async ({
    page,
  }) => {
    await page.goto('/login');

    await expect(
      page.getByRole('heading', { name: 'E2E Brand Title' }),
    ).toBeVisible();
    await expect(page.getByText('E2E Brand Subtitle')).toBeVisible();
    await expect(
      page.locator('img[src="https://example.com/e2e-icon.svg"]'),
    ).toBeVisible();
  });

  test('layout applies background image from config', async ({ page }) => {
    await page.goto('/login');

    await expect(
      page.locator('div[style*="e2e-background.jpg"]'),
    ).toBeVisible();
  });

  test('fixed language and theme settings hide selector controls', async ({
    page,
  }) => {
    await page.goto('/login');

    await expect(page.locator('select.select.select-ghost')).toHaveCount(0);
    await expect(page.locator('button.btn-circle.btn-sm')).toHaveCount(0);
  });
});
