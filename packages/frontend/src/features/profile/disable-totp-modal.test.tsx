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
import { DisableTotpModal } from './disable-totp-modal.tsx';

afterEach(() => {
  resetFetchMock();
});

test('disables TOTP with the submitted code and closes', async () => {
  const fetchMock = mockJsonSuccess({ ok: true });
  const onClose = vi.fn();
  const { screen, queryClient } = await renderProfileModal(
    <DisableTotpModal isOpen onClose={onClose} />,
  );
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

  await screen.getByPlaceholder('000000').fill('123456');
  await screen.getByTestId('disable-totp-submit').click();

  await vi.waitFor(() => {
    expect(onClose).toHaveBeenCalled();
  });

  const request = firstRequest(fetchMock.requests);
  expect(request.url).toBe('/api/user/totp');
  expect(request.method).toBe('DELETE');
  expect(jsonRequestBody(request)).toEqual({ code: '123456' });
  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: getSessionQueryOptions.queryKey,
  });
});

test('renders the preserved second-factor policy error', async () => {
  mockJsonError(
    {
      code: 'CANNOT_REMOVE_LAST_SECOND_FACTOR',
      message: 'Cannot remove last second factor',
    },
    400,
  );
  const { screen } = await renderProfileModal(
    <DisableTotpModal isOpen onClose={() => {}} />,
  );

  await screen.getByPlaceholder('000000').fill('123456');
  await screen.getByTestId('disable-totp-submit').click();

  await expect
    .element(screen.getByTestId('disable-totp-error'))
    .toHaveTextContent(
      'Cannot disable TOTP. At least one two-factor authentication method (TOTP or Passkey) is required.',
    );
});
