import { beforeAll, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { initTestI18n } from '#frontend/test-utils/i18n.ts';
import { UnlinkOAuthModal } from './unlink-oauth-modal.tsx';

beforeAll(() => {
  initTestI18n();
});

test('renders provider-specific copy and closes from the cancel action', async () => {
  const onClose = vi.fn();
  const onConfirm = vi.fn(async () => {});
  const screen = await render(
    <UnlinkOAuthModal
      isOpen={true}
      isPending={false}
      onClose={onClose}
      onConfirm={onConfirm}
      providerName="GitHub"
    />,
  );

  await expect.element(screen.getByText('Unlink Account')).toBeVisible();
  await expect
    .element(
      screen.getByText(
        'You will no longer be able to log in using GitHub. Make sure you have another way to access your account.',
      ),
    )
    .toBeVisible();

  await screen.getByTestId('unlink-oauth-cancel').click();

  expect(onClose).toHaveBeenCalledOnce();
  expect(onConfirm).not.toHaveBeenCalled();
});

test('confirms unlink and closes the modal when the action succeeds', async () => {
  const onClose = vi.fn();
  const onConfirm = vi.fn(async () => {});
  const screen = await render(
    <UnlinkOAuthModal
      isOpen={true}
      isPending={false}
      onClose={onClose}
      onConfirm={onConfirm}
      providerName="Google"
    />,
  );

  await screen.getByTestId('unlink-oauth-unlink').click();

  expect(onConfirm).toHaveBeenCalledOnce();
  expect(onClose).toHaveBeenCalledOnce();
});

test('shows an error banner and keeps the modal open when unlink fails', async () => {
  const onClose = vi.fn();
  const onConfirm = vi.fn(async () => {
    throw new Error('unlink failed');
  });
  const screen = await render(
    <UnlinkOAuthModal
      isOpen={true}
      isPending={false}
      onClose={onClose}
      onConfirm={onConfirm}
      providerName="Apple"
    />,
  );

  await screen.getByTestId('unlink-oauth-unlink').click();

  expect(onConfirm).toHaveBeenCalledOnce();
  expect(onClose).not.toHaveBeenCalled();
  await expect
    .element(
      screen.getByText('Cannot unlink. You need at least one way to log in.'),
    )
    .toBeVisible();
});

test('disables both actions while an unlink request is pending', async () => {
  const screen = await render(
    <UnlinkOAuthModal
      isOpen={true}
      isPending={true}
      onClose={() => {}}
      onConfirm={async () => {}}
      providerName="GitHub"
    />,
  );

  await expect
    .element(screen.getByTestId('unlink-oauth-cancel'))
    .toBeDisabled();
  await expect
    .element(screen.getByTestId('unlink-oauth-unlink'))
    .toBeDisabled();
  await expect.element(screen.getByText('Unlinking...')).toBeVisible();
});
