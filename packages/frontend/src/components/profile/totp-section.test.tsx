import { beforeAll, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { initTestI18n } from '#frontend/test-utils/i18n.js';
import { TotpSection } from './totp-section.js';

beforeAll(() => {
  initTestI18n();
});

test('renders enabled status with Regenerate and Disable buttons when totpEnabled is true', async () => {
  const onOpenModal = vi.fn();
  const screen = await render(
    <TotpSection
      onOpenModal={onOpenModal}
      recoveryCodesMissing={false}
      totpEnabled={true}
    />,
  );

  await expect.element(screen.getByText('Enabled')).toBeVisible();
  await expect
    .element(screen.getByTestId('profile-totp-regenerate'))
    .toBeVisible();
  await expect
    .element(screen.getByTestId('profile-totp-disable'))
    .toBeVisible();
});

test('renders recovery warning when recoveryCodesMissing is true', async () => {
  const onOpenModal = vi.fn();
  const screen = await render(
    <TotpSection
      onOpenModal={onOpenModal}
      recoveryCodesMissing={true}
      totpEnabled={true}
    />,
  );

  await expect
    .element(screen.getByText('Recovery codes need to be regenerated'))
    .toBeVisible();
});

test('renders disabled status with Enable button when totpEnabled is false', async () => {
  const onOpenModal = vi.fn();
  const screen = await render(
    <TotpSection
      onOpenModal={onOpenModal}
      recoveryCodesMissing={false}
      totpEnabled={false}
    />,
  );

  await expect
    .element(screen.getByText('Two-factor authentication is not enabled'))
    .toBeVisible();
  await expect.element(screen.getByTestId('profile-totp-enable')).toBeVisible();
});

test('calls onOpenModal with correct type for each button', async () => {
  const onOpenModal = vi.fn();

  const enableScreen = await render(
    <TotpSection
      onOpenModal={onOpenModal}
      recoveryCodesMissing={false}
      totpEnabled={false}
    />,
  );

  await enableScreen.getByTestId('profile-totp-enable').click();
  expect(onOpenModal).toHaveBeenCalledWith('setup');

  onOpenModal.mockClear();

  const enabledScreen = await render(
    <TotpSection
      onOpenModal={onOpenModal}
      recoveryCodesMissing={false}
      totpEnabled={true}
    />,
  );

  await enabledScreen.getByTestId('profile-totp-regenerate').click();
  expect(onOpenModal).toHaveBeenCalledWith('regenerate');

  onOpenModal.mockClear();

  await enabledScreen.getByTestId('profile-totp-disable').click();
  expect(onOpenModal).toHaveBeenCalledWith('disable');
});
