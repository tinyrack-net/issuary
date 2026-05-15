import { afterEach, expect, test, vi } from 'vitest';
import { getSessionQueryOptions } from '#frontend/queries/session.ts';
import { renderProfileModal } from '#frontend/test-utils/profile-modal-test-utils.tsx';
import {
  firstRequest,
  mockJsonError,
  mockJsonSuccess,
  mockPendingResponse,
  resetFetchMock,
} from '#frontend/test-utils/query-test-utils.ts';
import { DeleteAccountModal } from './delete-account-modal.tsx';

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    navigate: routerMocks.navigate,
  }),
}));

afterEach(() => {
  resetFetchMock();
  routerMocks.navigate.mockReset();
});

test('requires exact confirmation before deleting the account', async () => {
  mockJsonSuccess({ ok: true });
  const { screen } = await renderProfileModal(
    <DeleteAccountModal isOpen onClose={() => {}} retentionDays={30} />,
  );

  await screen.getByPlaceholder('delete').fill('keep');
  await screen.getByTestId('delete-account-submit').click();

  await expect
    .element(screen.getByTestId('delete-account-error'))
    .toHaveTextContent('The confirmation text does not match');
});

test('deletes the account, clears session state, and navigates to login', async () => {
  const fetchMock = mockJsonSuccess({ ok: true });
  const { screen, queryClient } = await renderProfileModal(
    <DeleteAccountModal isOpen onClose={() => {}} retentionDays={30} />,
  );
  const setQueryData = vi.spyOn(queryClient, 'setQueryData');

  await screen.getByPlaceholder('delete').fill('delete');
  await screen.getByTestId('delete-account-submit').click();

  await vi.waitFor(() => {
    expect(routerMocks.navigate).toHaveBeenCalledWith({ to: '/login' });
  });

  const request = firstRequest(fetchMock.requests);
  expect(request.url).toBe('/api/user');
  expect(request.method).toBe('DELETE');
  expect(setQueryData).toHaveBeenCalledWith(getSessionQueryOptions.queryKey, {
    user: null,
  });
});

test('renders an error and keeps the modal open when delete fails', async () => {
  mockJsonError(
    {
      code: 'DELETE_FAILED',
      message: 'Delete failed',
    },
    500,
  );
  const { screen } = await renderProfileModal(
    <DeleteAccountModal isOpen onClose={() => {}} retentionDays={30} />,
  );

  await screen.getByPlaceholder('delete').fill('delete');
  await screen.getByTestId('delete-account-submit').click();

  await expect
    .element(screen.getByText('Failed to delete account'))
    .toBeVisible();
  await expect
    .element(screen.getByTestId('delete-account-submit'))
    .toBeVisible();
});

test('disables destructive controls while account deletion is pending', async () => {
  mockPendingResponse();
  const { screen } = await renderProfileModal(
    <DeleteAccountModal isOpen onClose={() => {}} retentionDays={30} />,
  );

  await screen.getByPlaceholder('delete').fill('delete');
  await screen.getByTestId('delete-account-submit').click();

  await expect
    .element(screen.getByTestId('delete-account-submit'))
    .toBeDisabled();
  await expect
    .element(screen.getByTestId('delete-account-cancel'))
    .toBeDisabled();
});
