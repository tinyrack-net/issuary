import { expect, type Page, test as routeTest } from '@playwright/test';
import type { ScreenScenarioVariant } from '#frontend/test-utils/screen-scenario-catalog.ts';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import { screenScenarios } from '#frontend-e2e/screen-lab/catalog.ts';

const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const ROUTE_HOST_ORIGIN_ENV = 'SCREEN_LAB_ROUTE_HOST_ORIGIN';

function getSnapshotName(
  scenarioId: string,
  variant: ScreenScenarioVariant,
): string {
  if (variant.id === 'desktop' || variant.id === 'mobile') {
    return `${scenarioId}-${variant.id}.png`;
  }
  return `${scenarioId}-${variant.id}-desktop.png`;
}

async function configurePage(
  page: Page,
  variant: ScreenScenarioVariant,
): Promise<void> {
  await page.setViewportSize(
    variant.viewport === 'mobile' ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT,
  );
  await page.emulateMedia({
    colorScheme: variant.colorScheme,
    reducedMotion: 'reduce',
  });
  await page.addInitScript(
    ({ colorScheme, locale }) => {
      localStorage.setItem('issuary-color-scheme', colorScheme);
      localStorage.setItem('issuary-language', locale);
    },
    {
      colorScheme: variant.colorScheme,
      locale: variant.locale,
    },
  );
}

async function expectScreenScreenshot(
  page: Page,
  scenario: (typeof screenScenarios)[number],
  variant: ScreenScenarioVariant,
): Promise<void> {
  await expect(page.locator(scenario.readySelector).first()).toBeVisible();
  await expect(page).toHaveScreenshot(getSnapshotName(scenario.id, variant), {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    mask: (scenario.maskSelectors ?? []).map((selector) =>
      page.locator(selector),
    ),
  });
}

for (const scenario of screenScenarios) {
  if (scenario.runtime === 'route') {
    routeTest.describe(`${scenario.group}: ${scenario.title}`, () => {
      for (const variant of scenario.variants) {
        routeTest(`matches the ${variant.id} reference`, async ({ page }) => {
          await configurePage(page, variant);

          const routeHostOrigin = process.env[ROUTE_HOST_ORIGIN_ENV];
          if (!routeHostOrigin) {
            throw new Error('Screen Lab route host origin is unavailable.');
          }
          const url = new URL(
            '/e2e/screen-lab/route-host.html',
            routeHostOrigin,
          );
          url.searchParams.set('scenario', scenario.id);
          url.searchParams.set('variant', variant.id);
          await page.goto(url.href);

          await expectScreenScreenshot(page, scenario, variant);
        });
      }
    });
    continue;
  }

  const serverTest = createScenarioFixture(scenario.config);
  serverTest.describe(`${scenario.group}: ${scenario.title}`, () => {
    for (const variant of scenario.variants) {
      serverTest(
        `matches the ${variant.id} reference`,
        async ({ page, baseURL }) => {
          await configurePage(page, variant);
          await scenario.prepare({
            baseURL: String(baseURL),
            page,
            scenario,
          });
          await expectScreenScreenshot(page, scenario, variant);
        },
      );
    }
  });
}
