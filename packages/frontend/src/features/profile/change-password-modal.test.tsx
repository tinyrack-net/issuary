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
import { ChangePasswordModal } from './change-password-modal.tsx';

afterEach(() => {
  resetFetchMock();
});

test('changes password, invalidates the session, and closes', async () => {
  const fetchMock = mockJsonSuccess({ ok: true });
  const onClose = vi.fn();
  const { screen, queryClient } = await renderProfileModal(
    <ChangePasswordModal isOpen onClose={onClose} />,
  );
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

  await screen.getByPlaceholder('Enter current password').fill('old-password');
  await screen.getByPlaceholder('Enter new password').fill('new-password');
  await screen.getByPlaceholder('Confirm new password').fill('new-password');
  await screen.getByTestId('change-password-submit').click();

  await vi.waitFor(() => {
    expect(onClose).toHaveBeenCalled();
  });

  const request = firstRequest(fetchMock.requests);
  expect(request.url).toBe('/api/user/password');
  expect(request.method).toBe('PUT');
  expect(jsonRequestBody(request)).toEqual({
    current_password: 'old-password',
    new_password: 'new-password',
  });
  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: getSessionQueryOptions.queryKey,
  });
});

test('renders a field error when the current password is rejected', async () => {
  mockJsonError(
    {
      code: 'INVALID_CURRENT_PASSWORD',
      message: 'Invalid current password',
    },
    400,
  );
  const { screen } = await renderProfileModal(
    <ChangePasswordModal isOpen onClose={() => {}} />,
  );

  await screen
    .getByPlaceholder('Enter current password')
    .fill('wrong-password');
  await screen.getByPlaceholder('Enter new password').fill('new-password');
  await screen.getByPlaceholder('Confirm new password').fill('new-password');
  await screen.getByTestId('change-password-submit').click();

  await expect
    .element(screen.getByTestId('change-password-error-currentPassword'))
    .toHaveTextContent('Current password is incorrect');
});
