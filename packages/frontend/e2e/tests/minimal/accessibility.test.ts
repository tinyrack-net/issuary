import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
  E2E_TEST_USER_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';

const test = createScenarioFixture((backendPort) => ({
  ...E2E_BASE_CONFIG,
  ...createTestConfig(backendPort),
  users: [E2E_TEST_USER_CONFIG],
}));

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Unauthenticated auth screens. Each is reachable without a session, so they
 * can be audited directly.
 */
const ROUTES = [
  '/login',
  '/login/password',
  '/register',
  '/password/forgot',
  '/password/reset?token=placeholder',
  '/verify/email?email=someone@example.com',
  '/verify/totp',
  '/verify/totp/recovery',
  '/error?code=EXAMPLE&message=Example',
];

/**
 * Guards the accessibility of the auth surface.
 *
 * Both colour schemes are checked: the brand panel is pinned to the dark theme
 * and sits behind a scrim, so a contrast regression there would only show up
 * in one of them.
 */
test.describe('Auth screen accessibility', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    for (const route of ROUTES) {
      test(`${route} has no WCAG violations (${colorScheme})`, async ({
        page,
      }) => {
        await page.addInitScript((scheme) => {
          localStorage.setItem('tinyauth-color-scheme', scheme);
        }, colorScheme);

        await page.goto(route);

        const results = await new AxeBuilder({ page })
          .withTags(WCAG_TAGS)
          .analyze();

        expect(
          results.violations.map((violation) => ({
            id: violation.id,
            nodes: violation.nodes.map((node) => node.target.join(' ')),
          })),
        ).toEqual([]);
      });
    }
  }
});
