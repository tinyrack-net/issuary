import { afterEach, expect, test, vi } from 'vitest';
import { navigateDocument } from '#frontend/libs/document-navigation.js';
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

vi.mock('#frontend/libs/document-navigation.js', () => ({
  navigateDocument: vi.fn(),
}));

afterEach(() => {
  resetFetchMock();
  vi.clearAllMocks();
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
    expect(navigateDocument).toHaveBeenCalledWith('/login');
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
      screen.getByText(
        'Keep an enabled passkey or linked sign-in provider before removing your password.',
      ),
    )
    .toBeVisible();
});

test('shows a translated conflict and leaves the modal open for review', async () => {
  const fetchMock = mockJsonError(
    { code: 'CONCURRENT_SECURITY_CHANGE', message: 'Conflict' },
    409,
  );
  const onClose = vi.fn();
  const { screen } = await renderProfileModal(
    <RemovePasswordModal isOpen onClose={onClose} />,
  );
  await screen.getByPlaceholder('Enter current password').fill('old-password');
  await screen.getByTestId('remove-password-submit').click();
  await expect
    .element(
      screen.getByText(
        'Another security change conflicted with this request. Review your current settings before trying again.',
      ),
    )
    .toBeVisible();
  expect(onClose).not.toHaveBeenCalled();
  expect(fetchMock.requests).toHaveLength(1);
});
