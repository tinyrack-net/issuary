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
import { RemovePasswordModal } from './remove-password-modal.tsx';

afterEach(() => {
  resetFetchMock();
});

test('removes a password, invalidates the session, and closes', async () => {
  const fetchMock = mockJsonSuccess({ ok: true });
  const onClose = vi.fn();
  const { screen, queryClient } = await renderProfileModal(
    <RemovePasswordModal isOpen onClose={onClose} />,
  );
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

  await screen.getByPlaceholder('Enter current password').fill('old-password');
  await screen.getByTestId('remove-password-submit').click();

  await vi.waitFor(() => {
    expect(onClose).toHaveBeenCalled();
  });

  const request = firstRequest(fetchMock.requests);
  expect(request.url).toBe('/api/user/password');
  expect(request.method).toBe('DELETE');
  expect(jsonRequestBody(request)).toEqual({
    current_password: 'old-password',
  });
  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: getSessionQueryOptions.queryKey,
  });
});

test('renders the preserved policy error when password is the last auth method', async () => {
  mockJsonError(
    {
      code: 'CANNOT_REMOVE_LAST_AUTH_METHOD',
      message: 'Cannot remove last auth method',
    },
    400,
  );
  const { screen } = await renderProfileModal(
    <RemovePasswordModal isOpen onClose={() => {}} />,
  );

  await screen.getByPlaceholder('Enter current password').fill('old-password');
  await screen.getByTestId('remove-password-submit').click();

  await expect
    .element(
      screen.getByText('You must have at least one OAuth account linked'),
    )
    .toBeVisible();
});
