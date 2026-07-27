import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { createScenarioFixture } from '#frontend-e2e/fixtures/create-scenario-fixture.ts';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
  E2E_TEST_USER,
  E2E_TEST_USER_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
import { loginAndGoToProfile } from '#frontend-e2e/helpers/profile-page.ts';

const test = createScenarioFixture((backendPort) => ({
  ...E2E_BASE_CONFIG,
  ...createTestConfig(backendPort),
  users: [E2E_TEST_USER_CONFIG],
}));

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function waitForRenderedTheme(
  page: Page,
  colorScheme: 'light' | 'dark',
): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute(
    'data-theme',
    `tinyrack-${colorScheme}`,
  );
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading').first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  });
}

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
  '/verify/2fa',
  '/verify/passkey',
  '/setup/2fa',
  '/setup/passkey',
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
        await waitForRenderedTheme(page, colorScheme);

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

/**
 * Guards the accessibility of the signed-in surface.
 *
 * A separate block rather than another entry in `ROUTES`: `/profile` redirects
 * to `/login` without a session, so a bare `goto` would silently audit the
 * login screen a third time. This is the only screen on `AppLayout`, and its
 * header — brand mark, language, theme, sign-out — is guarded by nothing else.
 */
test.describe('Profile accessibility', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`/profile has no WCAG violations (${colorScheme})`, async ({
      page,
    }) => {
      await page.addInitScript((scheme) => {
        localStorage.setItem('tinyauth-color-scheme', scheme);
      }, colorScheme);

      await loginAndGoToProfile(
        page,
        E2E_TEST_USER.email,
        E2E_TEST_USER.password,
      );
      await waitForRenderedTheme(page, colorScheme);

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
});
