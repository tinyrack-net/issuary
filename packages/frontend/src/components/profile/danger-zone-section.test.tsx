import { beforeAll, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { initTestI18n } from '#frontend/test-utils/i18n.ts';
import { DangerZoneSection } from './danger-zone-section.tsx';

beforeAll(() => {
  initTestI18n();
});

test('does not render when account deletion is disabled', async () => {
  const { container } = await render(
    <DangerZoneSection
      isConfigManaged={false}
      isDeletionEnabled={false}
      onDeleteClick={() => {}}
    />,
  );

  expect(container.textContent).toBe('');
  expect(
    container.querySelector('[data-testid="profile-delete-account"]'),
  ).toBeNull();
});

test('renders a disabled delete action for config-managed accounts', async () => {
  const screen = await render(
    <DangerZoneSection
      isConfigManaged={true}
      isDeletionEnabled={true}
      onDeleteClick={() => {}}
    />,
  );

  await expect.element(screen.getByText('Danger Zone')).toBeVisible();
  await expect
    .element(
      screen.getByText(
        'This account is managed by configuration and cannot be deleted',
      ),
    )
    .toBeVisible();
  await expect
    .element(screen.getByTestId('profile-delete-account'))
    .toBeDisabled();
});

test('calls onDeleteClick when deletion is enabled', async () => {
  const onDeleteClick = vi.fn();
  const screen = await render(
    <DangerZoneSection
      isConfigManaged={false}
      isDeletionEnabled={true}
      onDeleteClick={onDeleteClick}
    />,
  );

  await screen.getByTestId('profile-delete-account').click();

  expect(onDeleteClick).toHaveBeenCalledOnce();
});
