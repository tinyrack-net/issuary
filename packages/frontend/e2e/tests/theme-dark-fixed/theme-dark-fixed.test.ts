import { expect } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';

const test = createScenarioFixture((backendPort) => ({
  ...E2E_BASE_CONFIG,
  ...createTestConfig(backendPort, {}),
}));

test.describe('Color scheme behavior', () => {
  test('color scheme toggle is visible', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByTestId('theme-toggle')).toBeVisible();
  });

  test('stored dark preference applies data-theme', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('issuary-color-scheme', 'dark');
    });
    await page.goto('/login');

    await expect
      .poll(async () => {
        return page.evaluate(() =>
          document.documentElement.getAttribute('data-theme'),
        );
      })
      .toBe('tinyrack-dark');
  });

  test('stored light preference applies data-theme', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('issuary-color-scheme', 'light');
    });
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
