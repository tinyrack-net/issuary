import { expect } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';

const test = createScenarioFixture((backendPort) => ({
  ...E2E_BASE_CONFIG,
  ...createTestConfig(backendPort, {
    i18n: {
      supported_languages: ['ko', 'en'],
      default_language: 'ko',
      fallback_language: 'en',
    },
    branding: {
      light_theme: 'cupcake',
      dark_theme: 'forest',
      theme_mode: 'system',
      title: {
        en: 'Theme System Title',
      },
      subtitle: {
        en: 'Theme System Subtitle',
      },
    },
    registration: {
      signup_notice: {
        en: 'Theme system <strong>implicit terms</strong> notice.',
      },
    },
  }),
}));

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

    const languageSelect = page.getByTestId('language-selector');
    await expect(languageSelect).toBeVisible();
    await expect(languageSelect.locator('option')).toHaveCount(3);
  });

  test('theme toggle cycles system to light to dark and back', async ({
    page,
  }) => {
    await page.goto('/login');

    const toggle = page.getByTestId('theme-toggle');
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

    const languageSelect = page.getByTestId('language-selector');
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

    const languageSelect = page.getByTestId('language-selector');
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
