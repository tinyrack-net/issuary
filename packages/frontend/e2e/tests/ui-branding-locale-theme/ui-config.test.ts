import {
  expect,
  test,
} from '#frontend-e2e/fixtures/ui-branding-locale-theme.js';

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

    await expect(page.getByTestId('language-selector')).toHaveCount(0);
    await expect(page.getByTestId('theme-toggle')).toHaveCount(0);
  });

  test('fixed light theme ignores stored theme preference', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem('tinyauth-theme-mode', 'dark');
    });
    await page.goto('/login');

    await expect
      .poll(async () => {
        return page.evaluate(() =>
          document.documentElement.getAttribute('data-theme'),
        );
      })
      .toBe('light');
  });
});
