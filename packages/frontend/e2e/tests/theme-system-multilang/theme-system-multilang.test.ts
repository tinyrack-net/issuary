import { expect, test } from '@frontend-e2e/fixtures/theme-system-multilang.js';

const THEME_MODE_STORAGE_KEY = 'tinyauth-theme-mode';
const LANGUAGE_STORAGE_KEY = 'tinyauth-language';

test.describe('Theme system and language fallback behavior', () => {
  test('lang fallback uses English branding and implicit notice', async ({
    page,
  }) => {
    await page.goto('/login?lang=ko');

    await expect(
      page.getByRole('heading', { name: 'Theme System Title' }),
    ).toBeVisible();
    await expect(page.getByText('Theme System Subtitle')).toBeVisible();
    await expect(
      page.getByText(/Theme system.*implicit terms.*notice\./),
    ).toBeVisible();

    const languageSelect = page.locator('select.select.select-ghost.select-sm');
    await expect(languageSelect).toBeVisible();
    await expect(languageSelect.locator('option')).toHaveCount(3);
  });

  test('theme toggle cycles system to light to dark and back', async ({
    page,
  }) => {
    await page.goto('/login');

    const toggle = page.locator('button.btn-circle.btn-sm');
    await expect(toggle).toBeVisible();

    await toggle.click();
    await expect
      .poll(async () => {
        return page.evaluate(() => ({
          mode: localStorage.getItem('tinyauth-theme-mode'),
          theme: document.documentElement.getAttribute('data-theme'),
        }));
      })
      .toEqual({ mode: 'light', theme: 'cupcake' });

    await toggle.click();
    await expect
      .poll(async () => {
        return page.evaluate(() => ({
          mode: localStorage.getItem('tinyauth-theme-mode'),
          theme: document.documentElement.getAttribute('data-theme'),
        }));
      })
      .toEqual({ mode: 'dark', theme: 'forest' });

    await toggle.click();
    await expect
      .poll(async () => {
        return page.evaluate(
          (themeModeStorageKey) => localStorage.getItem(themeModeStorageKey),
          THEME_MODE_STORAGE_KEY,
        );
      })
      .toBeNull();
  });

  test('language selector updates persisted language preference', async ({
    page,
  }) => {
    await page.goto('/login');

    const languageSelect = page.locator('select.select.select-ghost.select-sm');
    await languageSelect.selectOption('en');

    await expect
      .poll(async () => {
        return page.evaluate(
          (languageStorageKey) => localStorage.getItem(languageStorageKey),
          LANGUAGE_STORAGE_KEY,
        );
      })
      .toBe('en');
  });

  test('switching language selector to auto clears stored preference', async ({
    page,
  }) => {
    await page.goto('/login');

    const languageSelect = page.locator('select.select.select-ghost.select-sm');
    await languageSelect.selectOption('en');
    await languageSelect.selectOption('auto');

    await expect
      .poll(async () => {
        return page.evaluate(
          (languageStorageKey) => localStorage.getItem(languageStorageKey),
          LANGUAGE_STORAGE_KEY,
        );
      })
      .toBeNull();

    await expect(languageSelect).toHaveValue('auto');
  });
});
