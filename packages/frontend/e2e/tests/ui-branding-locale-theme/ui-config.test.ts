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
      icon_url: 'https://example.com/e2e-icon.svg',
      title: {
        en: 'E2E Brand Title',
      },
    },
  }),
}));

test.describe('UI config driven rendering', () => {
  test('login page renders branding title and icon with heading hierarchy', async ({
    page,
  }) => {
    await page.goto('/login');

    await expect(
      page.getByRole('heading', { level: 1, name: 'E2E Brand Title' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Welcome back!' }),
    ).toBeVisible();
    await expect(
      page.locator('img[src="https://example.com/e2e-icon.svg"]'),
    ).toBeVisible();
  });

  test('fixed language and theme settings hide selector controls', async ({
    page,
  }) => {
    await page.goto('/login');

    await expect(page.getByTestId('language-selector')).toHaveCount(0);
    await expect(page.getByTestId('theme-toggle')).toBeVisible();
  });

  test('theme toggle cycles through theme modes', async ({ page }) => {
    await page.goto('/login');

    await expect
      .poll(async () => {
        return page.evaluate(() =>
          document.documentElement.getAttribute('data-theme'),
        );
      })
      .toBe('tinyrack-light');
  });
});
