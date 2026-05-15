import { afterEach, expect, test, vi } from 'vitest';
import { getSessionQueryOptions } from '#frontend/queries/session.ts';
import { renderProfileModal } from '#frontend/test-utils/profile-modal-test-utils.tsx';
import {
  firstRequest,
  jsonRequestBody,
  mockJsonError,
  mockJsonSuccess,
  resetFetchMock,
} from '#frontend/test-utils/query-test-utils.ts';
import { SetPasswordModal } from './set-password-modal.tsx';

afterEach(() => {
  resetFetchMock();
});

test('sets a password, invalidates the session, and closes', async () => {
  const fetchMock = mockJsonSuccess({ ok: true });
  const onClose = vi.fn();
  const { screen, queryClient } = await renderProfileModal(
    <SetPasswordModal isOpen onClose={onClose} />,
  );
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

  await screen.getByPlaceholder('Enter new password').fill('new-password');
  await screen.getByPlaceholder('Confirm new password').fill('new-password');
  await screen.getByTestId('set-password-submit').click();

  await vi.waitFor(() => {
    expect(onClose).toHaveBeenCalled();
  });

  const request = firstRequest(fetchMock.requests);
  expect(request.url).toBe('/api/user/password');
  expect(request.method).toBe('POST');
  expect(jsonRequestBody(request)).toEqual({ password: 'new-password' });
  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: getSessionQueryOptions.queryKey,
  });
});

test('renders a modal-level error when setting a password fails', async () => {
  mockJsonError(
    {
      code: 'PASSWORD_REJECTED',
      message: 'Rejected',
    },
    400,
  );
  const { screen } = await renderProfileModal(
    <SetPasswordModal isOpen onClose={() => {}} />,
  );

  await screen.getByPlaceholder('Enter new password').fill('new-password');
  await screen.getByPlaceholder('Confirm new password').fill('new-password');
  await screen.getByTestId('set-password-submit').click();

  await expect
    .element(screen.getByText('Failed to set password'))
    .toBeVisible();
});
