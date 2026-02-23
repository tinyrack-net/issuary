import { expect, test } from '@frontend-e2e/fixtures/terms.js';
import { modal } from '@frontend-e2e/helpers/profile-page.js';
import { registerPage } from '@frontend-e2e/helpers/register-page.js';

test.describe('TermsContentModal', () => {
  test('clicking View link on text-type terms opens content modal', async ({
    page,
  }) => {
    await page.goto('/register');

    // Both terms are type 'text', so "View" links should be visible
    const viewLinks = page.getByRole('button', { name: 'View' });
    await expect(viewLinks.first()).toBeVisible();

    // Click the first "View" link (Terms of Service)
    await viewLinks.first().click();

    // Modal should open
    await expect(page.locator(modal.openModal)).toBeVisible();

    // Modal title should show "Terms of Service"
    await expect(
      page.locator(modal.openModal).getByRole('heading').first(),
    ).toContainText('Terms of Service');

    // Content should be displayed
    await expect(
      page.getByText('Test Terms of Service content for e2e testing.'),
    ).toBeVisible();
  });

  test('closing terms content modal returns to form', async ({ page }) => {
    await page.goto('/register');

    const viewLinks = page.getByRole('button', { name: 'View' });
    await viewLinks.first().click();

    await expect(page.locator(modal.openModal)).toBeVisible();

    // Close the modal using the X button
    await page.locator(modal.closeButton).click();

    // Modal should close
    await expect(page.locator(modal.openModal)).not.toBeVisible();

    // Registration form should still be visible
    await expect(page.locator(registerPage.emailInput)).toBeVisible();
  });

  test('privacy policy modal shows correct content', async ({ page }) => {
    await page.goto('/register');

    // Click the second "View" link (Privacy Policy)
    const viewLinks = page.getByRole('button', { name: 'View' });
    await viewLinks.nth(1).click();

    // Modal should open
    await expect(page.locator(modal.openModal)).toBeVisible();

    // Modal title should show "Privacy Policy"
    await expect(
      page.locator(modal.openModal).getByRole('heading').first(),
    ).toContainText('Privacy Policy');

    // Content should be displayed
    await expect(
      page.getByText('Test Privacy Policy content for e2e testing.'),
    ).toBeVisible();
  });

  test('backdrop click closes modal', async ({ page }) => {
    await page.goto('/register');

    const viewLinks = page.getByRole('button', { name: 'View' });
    await viewLinks.first().click();
    await expect(page.locator(modal.openModal)).toBeVisible();

    // Press Escape to close the modal (simulates backdrop/close behavior)
    await page.keyboard.press('Escape');

    // Modal should close
    await expect(page.locator(modal.openModal)).not.toBeVisible();
  });
});
