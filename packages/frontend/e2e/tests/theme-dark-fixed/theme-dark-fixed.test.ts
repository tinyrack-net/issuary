import { expect, test } from '@frontend-e2e/fixtures/theme-dark-fixed.js';

test.describe('Fixed dark theme configuration', () => {
  test('fixed dark mode hides theme toggle controls', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByTestId('theme-toggle')).toHaveCount(0);
  });

  test('fixed dark mode ignores stored light preference', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('tinyauth-theme-mode', 'light');
    });
    await page.goto('/login');

    await expect
      .poll(async () => {
        return page.evaluate(() =>
          document.documentElement.getAttribute('data-theme'),
        );
      })
      .toBe('dark');
  });
});
