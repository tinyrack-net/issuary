import { expect } from '@playwright/test';
import { createProxyHandler } from '@tinyauth/backend/frontend/proxy';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
  E2E_TEST_USER_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';

const test = createScenarioFixture((backendPort, frontendPort) => ({
  ...E2E_BASE_CONFIG,
  ...createTestConfig(backendPort),
  users: [E2E_TEST_USER_CONFIG],
  frontend: createProxyHandler({
    upstream: `http://localhost:${frontendPort}`,
    htmlVariables: {
      TITLE: 'E2E Interpolated Title',
      DESCRIPTION: 'E2E interpolated description text',
      FAVICON_URL: '/e2e-test-favicon.ico',
      COLOR_SCHEME: 'dark',
      THEME_COLOR: '#ff5733',
      OG_IMAGE_URL: 'https://example.com/og-image.png',
      OG_URL: 'https://example.com',
      APPLE_TOUCH_ICON_URL: '/e2e-apple-touch-icon.png',
    },
  }),
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

  test('robots meta tag is present', async ({ page }) => {
    await page.goto('/login');
    const content = await page
      .locator('meta[name="robots"]')
      .getAttribute('content');
    expect(content).toBe('noindex, nofollow');
  });

  test('color-scheme is interpolated', async ({ page }) => {
    await page.goto('/login');
    const content = await page
      .locator('meta[name="color-scheme"]')
      .getAttribute('content');
    expect(content).toBe('dark');
  });

  test('theme-color is interpolated', async ({ page }) => {
    await page.goto('/login');
    const content = await page
      .locator('meta[name="theme-color"]')
      .getAttribute('content');
    expect(content).toBe('#ff5733');
  });

  test('og:type is present', async ({ page }) => {
    await page.goto('/login');
    const content = await page
      .locator('meta[property="og:type"]')
      .getAttribute('content');
    expect(content).toBe('website');
  });

  test('og:title is interpolated', async ({ page }) => {
    await page.goto('/login');
    const content = await page
      .locator('meta[property="og:title"]')
      .getAttribute('content');
    expect(content).toBe('E2E Interpolated Title');
  });

  test('og:description is interpolated', async ({ page }) => {
    await page.goto('/login');
    const content = await page
      .locator('meta[property="og:description"]')
      .getAttribute('content');
    expect(content).toBe('E2E interpolated description text');
  });

  test('og:image is interpolated', async ({ page }) => {
    await page.goto('/login');
    const content = await page
      .locator('meta[property="og:image"]')
      .getAttribute('content');
    expect(content).toBe('https://example.com/og-image.png');
  });

  test('og:url is interpolated', async ({ page }) => {
    await page.goto('/login');
    const content = await page
      .locator('meta[property="og:url"]')
      .getAttribute('content');
    expect(content).toBe('https://example.com');
  });

  test('apple-touch-icon is interpolated', async ({ page }) => {
    await page.goto('/login');
    const href = await page
      .locator('link[rel="apple-touch-icon"]')
      .getAttribute('href');
    expect(href).toBe('/e2e-apple-touch-icon.png');
  });
});

const testPartial = createScenarioFixture((backendPort, frontendPort) => ({
  ...E2E_BASE_CONFIG,
  ...createTestConfig(backendPort),
  users: [E2E_TEST_USER_CONFIG],
  frontend: createProxyHandler({
    upstream: `http://localhost:${frontendPort}`,
    htmlVariables: {
      TITLE: 'Partial Interpolation',
    },
  }),
}));

testPartial.describe('HTML interpolation - partial variables', () => {
  testPartial('user-provided variables override defaults', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle('Partial Interpolation');
    const content = await page
      .locator('meta[name="description"]')
      .getAttribute('content');
    expect(content).toBe('OIDC Provider for everyone');
  });

  testPartial(
    'new meta tags use defaults when not overridden',
    async ({ page }) => {
      await page.goto('/login');
      const colorScheme = await page
        .locator('meta[name="color-scheme"]')
        .getAttribute('content');
      expect(colorScheme).toBe('light dark');

      const themeColor = await page
        .locator('meta[name="theme-color"]')
        .getAttribute('content');
      expect(themeColor).toBe('#570df8');

      const appleTouchIcon = await page
        .locator('link[rel="apple-touch-icon"]')
        .getAttribute('href');
      expect(appleTouchIcon).toBe('/vite.svg');
    },
  );
});
