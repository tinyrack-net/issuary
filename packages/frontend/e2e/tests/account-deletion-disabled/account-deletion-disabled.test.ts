import {
  expect,
  test,
} from '@frontend-e2e/fixtures/account-deletion-disabled.js';
import { E2E_TEST_USER } from '@frontend-e2e/fixtures/index.js';
import { loginAndGoToProfile } from '@frontend-e2e/helpers/profile-page.js';

test.describe('Account deletion disabled configuration', () => {
  test('profile hides delete account entry points', async ({ page }) => {
    await loginAndGoToProfile(
      page,
      E2E_TEST_USER.email,
      E2E_TEST_USER.password,
    );

    await expect(
      page.getByRole('heading', { name: 'Danger Zone' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Delete Account' }),
    ).toHaveCount(0);
  });
});
