import { test as base, type Page } from '@playwright/test';
import { createApiHelpers } from '../utils/api-helpers';
import { generateEmail, generatePassword } from './test-data.fixture';

/**
 * Test user credentials type
 */
export type TestUser = {
  email: string;
  password: string;
  cleanup: () => Promise<void>;
};

/**
 * Auth fixtures for e2e tests
 */
export type AuthFixtures = {
  /**
   * A page with a logged-in user session
   */
  authenticatedPage: Page;

  /**
   * Test user credentials with cleanup function
   */
  testUser: TestUser;
};

/**
 * Extended test with auth fixtures
 */
export const test = base.extend<AuthFixtures>({
  /**
   * Creates a test user and provides cleanup function
   */
  testUser: async ({ request }, use) => {
    const email = generateEmail();
    const password = generatePassword();

    // Register the test user via API (with auto terms consent)
    const apiHelpers = createApiHelpers(request);
    await apiHelpers.register(email, password);

    const cleanup = async () => {
      // Note: Account deletion may require authentication
      // For now, we rely on the test database being reset between test runs
      // or implement proper cleanup if the API supports it
    };

    await use({ email, password, cleanup });

    // Cleanup after test
    await cleanup();
  },

  /**
   * Provides a page with authenticated session
   */
  authenticatedPage: async ({ page, request }, use) => {
    const email = generateEmail();
    const password = generatePassword();

    // Register the test user via API (with auto terms consent)
    const apiHelpers = createApiHelpers(request);
    await apiHelpers.register(email, password);

    // Login via API to get session cookie
    await apiHelpers.login(email, password);

    // Get cookies from the API request context and apply to page
    const cookies = await request.storageState();
    await page.context().addCookies(cookies.cookies);

    await use(page);
  },
});

export { expect } from '@playwright/test';
