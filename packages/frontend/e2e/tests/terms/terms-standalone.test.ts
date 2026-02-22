import { E2E_TEST_USER } from '@frontend-e2e/fixtures/index.js';
import { loginAndGoToProfile } from '@frontend-e2e/helpers/profile-page.js';
import { registerPage } from '@frontend-e2e/helpers/register-page.js';
import { expect, test } from '@playwright/test';

test.describe('Standalone terms page', () => {
  // Run serially: these tests share the config-managed E2E_TEST_USER
  // and concurrent logins can cause session conflicts.
  test.describe.configure({ mode: 'serial' });

  test('displays explicit terms checkboxes', async ({ page }) => {
    await loginAndGoToProfile(
      page,
      E2E_TEST_USER.email,
      E2E_TEST_USER.password,
    );

    // Navigate to terms page
    await page.goto('/terms', { waitUntil: 'networkidle' });

    // Should show the terms heading
    await expect(
      page.getByRole('heading', { name: 'Terms of Service' }),
    ).toBeVisible();

    // Explicit terms checkboxes should be visible
    const checkboxes = page.locator(registerPage.termsCheckbox);
    await expect(checkboxes.first()).toBeVisible();
  });

  test('submitting without required terms shows validation error', async ({
    page,
  }) => {
    await loginAndGoToProfile(
      page,
      E2E_TEST_USER.email,
      E2E_TEST_USER.password,
    );

    await page.goto('/terms');
    await expect(
      page.getByRole('heading', { name: 'Terms of Service' }),
    ).toBeVisible({ timeout: 10000 });

    // Uncheck all checkboxes to ensure required terms are NOT agreed.
    // Under parallel execution, another browser (chromium) may have
    // already submitted consent for this config-managed user, causing
    // checkboxes to be pre-checked.
    const checkboxes = page.locator(registerPage.termsCheckbox);
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).uncheck();
    }

    // Submit without required terms
    await page.locator('button[type="submit"]').click();

    // Should show validation error
    await expect(page.locator('.text-error').first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('agreeing to required terms and submitting succeeds', async ({
    page,
  }) => {
    await loginAndGoToProfile(
      page,
      E2E_TEST_USER.email,
      E2E_TEST_USER.password,
    );

    await page.goto('/terms', { waitUntil: 'networkidle' });

    // Wait for page to load
    await expect(
      page.getByRole('heading', { name: 'Terms of Service' }),
    ).toBeVisible();

    // Check all checkboxes
    const checkboxes = page.locator(registerPage.termsCheckbox);
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check();
    }

    // Submit
    await page.locator('button[type="submit"]').click();

    // Should redirect (either to profile or another page)
    // The terms page redirects on success
    await page.waitForURL((url) => !url.pathname.startsWith('/terms'), {
      timeout: 10000,
    });
  });
});
