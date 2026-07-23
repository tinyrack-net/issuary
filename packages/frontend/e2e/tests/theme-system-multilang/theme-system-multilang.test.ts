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

const LANGUAGE_STORAGE_KEY = 'tinyauth-language';

test.describe('Color scheme and language fallback behavior', () => {
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

    const languageSelector = page.getByTestId('language-selector');
    await expect(languageSelector).toBeVisible();
  });

  test('color scheme toggle switches between light and dark', async ({
    page,
  }) => {
    await page.goto('/login');

    const toggle = page.getByTestId('theme-toggle');
    await expect(toggle).toBeVisible();

    await toggle.click();
    await expect
      .poll(async () => {
        return page.evaluate(() => ({
          scheme: localStorage.getItem('tinyauth-color-scheme'),
          theme: document.documentElement.getAttribute('data-theme'),
        }));
      })
      .toEqual({ scheme: 'dark', theme: 'tinyrack-dark' });

    await toggle.click();
    await expect
      .poll(async () => {
        return page.evaluate(() => ({
          scheme: localStorage.getItem('tinyauth-color-scheme'),
          theme: document.documentElement.getAttribute('data-theme'),
        }));
      })
      .toEqual({ scheme: 'light', theme: 'tinyrack-light' });
  });

  test('language selector updates persisted language preference', async ({
    page,
  }) => {
    await page.goto('/login');

    const languageSelector = page.getByTestId('language-selector');
    await languageSelector.click();

    await page.getByRole('option', { name: 'English' }).click();

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

    const languageSelector = page.getByTestId('language-selector');
    await languageSelector.click();

    await page.getByRole('option', { name: 'English' }).click();

    await languageSelector.click();
    await page.getByRole('option', { name: 'Auto' }).click();

    await expect
      .poll(async () => {
        return page.evaluate(
          (languageStorageKey) => localStorage.getItem(languageStorageKey),
          LANGUAGE_STORAGE_KEY,
        );
      })
      .toBeNull();
  });
});
