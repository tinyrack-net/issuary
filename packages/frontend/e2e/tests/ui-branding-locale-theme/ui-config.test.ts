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
      supported_languages: ['en'],
      default_language: 'en',
      fallback_language: 'en',
    },
    branding: {
      theme_mode: 'light',
      background_url: 'https://example.com/e2e-background.jpg',
      icon_url: 'https://example.com/e2e-icon.svg',
      title: {
        en: 'E2E Brand Title',
      },
      subtitle: {
        en: 'E2E Brand Subtitle',
      },
    },
  }),
}));

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
