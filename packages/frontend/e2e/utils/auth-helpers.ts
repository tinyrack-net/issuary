import type { Page } from '@playwright/test';
import { ROUTES, TEST_USER } from '../fixtures/test-data';

/**
 * Login with test user credentials
 */
export async function login(
  page: Page,
  email = TEST_USER.email,
  password = TEST_USER.password,
): Promise<void> {
  await page.goto(ROUTES.login);
  await page.getByPlaceholder(/hello@example.com/i).fill(email);
  await page.getByPlaceholder(/enter your password/i).fill(password);
  await page.getByRole('button', { name: /log in/i }).click();
}

/**
 * Login and wait for profile page navigation
 */
export async function loginAndWaitForProfile(
  page: Page,
  email = TEST_USER.email,
  password = TEST_USER.password,
): Promise<void> {
  await login(page, email, password);
  await page.waitForURL(ROUTES.profile, { timeout: 10000 });
}

/**
 * Logout from the application
 */
export async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: /log out/i }).click();
  await page.waitForURL(ROUTES.login, { timeout: 10000 });
}

/**
 * Register a new user
 */
export async function register(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto(ROUTES.register);
  await page.getByPlaceholder(/hello@example.com/i).fill(email);
  await page.getByPlaceholder(/enter your password/i).fill(password);
  await page.getByRole('button', { name: /create account/i }).click();
}

/**
 * Check if user is logged in by trying to access profile
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  await page.goto(ROUTES.profile);
  await page.waitForLoadState('networkidle');
  return page.url().includes(ROUTES.profile);
}

/**
 * Ensure user is logged out before test
 */
export async function ensureLoggedOut(page: Page): Promise<void> {
  // Clear cookies to ensure clean state
  await page.context().clearCookies();
}
