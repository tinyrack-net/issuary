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
    },
    registration: {
      signup_notice: {
        en: 'Theme system <strong>implicit terms</strong> notice.',
      },
    },
  }),
}));

const LANGUAGE_STORAGE_KEY = 'issuary-language';

test.describe('Color scheme and language fallback behavior', () => {
  test('lang fallback uses English branding and implicit notice', async ({
    page,
  }) => {
    await page.goto('/login?lang=ko');

    await expect(
      page.getByRole('heading', { name: 'Theme System Title' }),
    ).toBeVisible();
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
          scheme: localStorage.getItem('issuary-color-scheme'),
          theme: document.documentElement.getAttribute('data-theme'),
        }));
      })
      .toEqual({ scheme: 'dark', theme: 'tinyrack-dark' });

    await toggle.click();
    await expect
      .poll(async () => {
        return page.evaluate(() => ({
          scheme: localStorage.getItem('issuary-color-scheme'),
          theme: document.documentElement.getAttribute('data-theme'),
        }));
      })
      .toEqual({ scheme: 'light', theme: 'tinyrack-light' });
  });

  test('language selector follows the footer and icon contract', async ({
    page,
  }) => {
    await page.goto('/login');

    const languageSelector = page.getByTestId('language-selector');
    await languageSelector.click();
    await page.getByRole('option', { exact: true, name: 'English' }).click();
    await languageSelector.click();
    await page.getByRole('option', { name: /^Auto \(/ }).click();

    await expect(languageSelector).toHaveAttribute('data-appearance', 'ghost');
    await expect(languageSelector).toContainText(/^Auto \(/);
    await expect(languageSelector.locator('svg')).toHaveCount(2);

    const footer = page.locator('footer').filter({ has: languageSelector });
    await expect(footer).toHaveCount(1);
    await expect(
      page.locator('header').getByTestId('language-selector'),
    ).toHaveCount(0);

    const triggerBox = await languageSelector.boundingBox();
    const mainBox = await page.locator('main').boundingBox();
    const footerBox = await footer.boundingBox();
    const viewport = page.viewportSize();
    if (!triggerBox || !mainBox || !footerBox || !viewport) {
      throw new Error('Expected the shell layout to have measurable boxes');
    }

    expect(
      Math.abs(triggerBox.x + triggerBox.width / 2 - viewport.width / 2),
    ).toBeLessThanOrEqual(1);
    expect(mainBox.y + mainBox.height).toBeLessThanOrEqual(footerBox.y);

    await languageSelector.click();
    const selectedOption = page.getByRole('option', {
      name: /^Auto \(/,
      selected: true,
    });
    const checkIconSize = await selectedOption
      .locator('.tr-select-item-indicator > svg')
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return { height: style.height, width: style.width };
      });
    expect(checkIconSize).toEqual({ height: '16px', width: '16px' });
  });

  test('language selector updates persisted language preference', async ({
    page,
  }) => {
    await page.goto('/login');

    const languageSelector = page.getByTestId('language-selector');
    await languageSelector.click();

    // Exact: the auto option is labelled "Auto (English)", so a substring
    // match finds two options and fails strict mode.
    await page.getByRole('option', { exact: true, name: 'English' }).click();

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

    // Exact: the auto option is labelled "Auto (English)", so a substring
    // match finds two options and fails strict mode.
    await page.getByRole('option', { exact: true, name: 'English' }).click();

    await languageSelector.click();
    await page.getByRole('option', { name: /^Auto \(/ }).click();

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
