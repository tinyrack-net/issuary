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
    auth: {
      passkey: {
        enabled: true,
      },
    },
    branding: {
      icon_url: 'https://example.com/e2e-icon.svg',
      title: {
        en: 'E2E Brand Title',
      },
      subtitle: {
        en: 'E2E Brand Subtitle',
      },
      login_method_description: {
        en: 'E2E login method guidance.',
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
    await expect(page.getByText('E2E Brand Subtitle')).toBeVisible();
    await expect(page.getByText('E2E login method guidance.')).toBeVisible();
    await expect(
      page.locator('img[src="https://example.com/e2e-icon.svg"]'),
    ).toBeVisible();
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(0);

    const [
      titleSize,
      titleColor,
      subtitleSize,
      subtitleColor,
      brandGap,
      titleAlignment,
      subtitleAlignment,
      guidanceBottomGap,
    ] = await Promise.all([
      page
        .getByRole('heading', { level: 1, name: 'E2E Brand Title' })
        .evaluate((element) => getComputedStyle(element).fontSize),
      page
        .getByRole('heading', { level: 1, name: 'E2E Brand Title' })
        .evaluate((element) => getComputedStyle(element).color),
      page
        .getByText('E2E Brand Subtitle')
        .evaluate((element) => getComputedStyle(element).fontSize),
      page
        .getByText('E2E Brand Subtitle')
        .evaluate((element) => getComputedStyle(element).color),
      page
        .getByText('E2E Brand Subtitle')
        .evaluate(
          (element) =>
            getComputedStyle(element.parentElement ?? element).rowGap,
        ),
      page
        .getByRole('heading', { level: 1, name: 'E2E Brand Title' })
        .evaluate(
          (element) =>
            getComputedStyle(element.parentElement ?? element).justifyContent,
        ),
      page
        .getByText('E2E Brand Subtitle')
        .evaluate((element) => getComputedStyle(element).textAlign),
      page.getByText('E2E login method guidance.').evaluate((element) => {
        const method = element.parentElement?.querySelector(
          'a[href^="/login/password"]',
        );
        if (!method) {
          return null;
        }
        const guidanceBounds = element.getBoundingClientRect();
        const methodBounds = method.getBoundingClientRect();
        return Math.round(methodBounds.top - guidanceBounds.bottom);
      }),
    ]);
    expect(Number.parseFloat(titleSize)).toBeGreaterThan(
      Number.parseFloat(subtitleSize),
    );
    expect(subtitleSize).toBe('20px');
    expect(subtitleColor).not.toBe(titleColor);
    expect(brandGap).toBe('8px');
    expect(titleAlignment).toBe('center');
    expect(subtitleAlignment).toBe('center');
    expect(guidanceBottomGap).toBe(16);
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
