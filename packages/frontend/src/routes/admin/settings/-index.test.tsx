import { describe, expect, test } from 'vitest';
import {
  appConfigQueryData,
  renderRoute,
  routeTestUser,
} from '#frontend/test-utils/route-test-utils.tsx';

describe('/admin/settings', () => {
  test('keeps language and theme preferences on the settings page', async () => {
    const { screen } = await renderRoute({
      initialLocation: '/admin/settings',
      queryData: [appConfigQueryData()],
      user: { ...routeTestUser, role: 'admin' },
    });

    await expect
      .element(screen.getByRole('heading', { name: 'Settings' }))
      .toBeVisible();
    const languageSelect = screen.getByRole('combobox', {
      name: 'Select language',
    });
    await expect.element(languageSelect).toBeVisible();
    await expect
      .element(languageSelect)
      .toHaveAttribute('data-appearance', 'solid');
    const themeSelect = screen.getByRole('combobox', { name: 'Theme' });
    await expect
      .element(themeSelect)
      .toHaveAttribute('data-appearance', 'solid');
    await themeSelect.click();
    await screen.getByRole('option', { name: 'Dark' }).click();
    expect(document.documentElement.getAttribute('data-theme')).toBe(
      'tinyrack-dark',
    );
  });
});
