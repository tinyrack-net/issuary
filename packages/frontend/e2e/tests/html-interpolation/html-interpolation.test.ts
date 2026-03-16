import { expect } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.js';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
  E2E_TEST_USER_CONFIG,
} from '#frontend-e2e/fixtures/index.js';

const test = createScenarioFixture((backendPort) => ({
  ...E2E_BASE_CONFIG,
  ...createTestConfig(backendPort),
  users: [E2E_TEST_USER_CONFIG],
  html_variables: {
    TITLE: 'E2E Interpolated Title',
    DESCRIPTION: 'E2E interpolated description text',
    FAVICON_URL: '/e2e-test-favicon.ico',
  },
}));

test.describe('HTML interpolation', () => {
  test('page title is interpolated', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle('E2E Interpolated Title');
  });

  test('meta description is interpolated', async ({ page }) => {
    await page.goto('/login');
    const content = await page
      .locator('meta[name="description"]')
      .getAttribute('content');
    expect(content).toBe('E2E interpolated description text');
  });

  test('favicon link is interpolated', async ({ page }) => {
    await page.goto('/login');
    const href = await page.locator('link[rel="icon"]').getAttribute('href');
    expect(href).toBe('/e2e-test-favicon.ico');
  });
});

const testPartial = createScenarioFixture((backendPort) => ({
  ...E2E_BASE_CONFIG,
  ...createTestConfig(backendPort),
  users: [E2E_TEST_USER_CONFIG],
  html_variables: {
    TITLE: 'Partial Interpolation',
  },
}));

testPartial.describe('HTML interpolation - partial variables', () => {
  testPartial('unset variables remain as placeholders', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle('Partial Interpolation');
    const content = await page
      .locator('meta[name="description"]')
      .getAttribute('content');
    expect(content).toBe('{{DESCRIPTION}}');
  });
});
