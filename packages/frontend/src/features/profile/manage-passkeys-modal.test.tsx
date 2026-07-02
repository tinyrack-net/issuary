import { afterEach, expect, test, vi } from 'vitest';
import { getSessionQueryOptions } from '#frontend/queries/session.ts';
import { renderProfileModal } from '#frontend/test-utils/profile-modal-test-utils.tsx';
import {
  jsonRequestBody,
  mockJsonResponses,
  resetFetchMock,
} from '#frontend/test-utils/query-test-utils.ts';
import { ManagePasskeysModal } from './manage-passkeys-modal.tsx';

const passkeysResponse = {
  passkeys: [
    {
      id: 'passkey-1',
      name: 'Laptop',
      created_at: '2026-05-01T00:00:00.000Z',
      last_used_at: null,
      backed_up: true,
      device_type: 'multiDevice',
    },
  ],
};

afterEach(() => {
  resetFetchMock();
});

test('renames a passkey and refreshes passkey data', async () => {
  const fetchMock = mockJsonResponses(
    { url: '/api/user/passkeys', method: 'GET', body: passkeysResponse },
    {
      url: '/api/user/passkeys/passkey-1',
      method: 'PATCH',
      body: { ok: true },
    },
    { url: '/api/user/passkeys', method: 'GET', body: passkeysResponse },
  );
  const { screen } = await renderProfileModal(
    <ManagePasskeysModal isOpen onAddNew={() => {}} onClose={() => {}} />,
  );

  await expect.element(screen.getByText('Laptop')).toBeVisible();
  await screen.getByLabelText('Rename').click();
  await screen.getByTestId('passkey-rename-input').fill('Security Key');
  await screen.getByText('Save').click();

  await vi.waitFor(() => {
    expect(fetchMock.requests.length).toBeGreaterThanOrEqual(3);
  });

  const request = fetchMock.requests[1];
  expect(request).toEqual(
    expect.objectContaining({
      url: '/api/user/passkeys/passkey-1',
      method: 'PATCH',
    }),
  );
  expect(jsonRequestBody(request)).toEqual({ name: 'Security Key' });
  fetchMock.assertAllResponsesConsumed();
});

test('requires inline confirmation before deleting a passkey', async () => {
  const fetchMock = mockJsonResponses(
    { url: '/api/user/passkeys', method: 'GET', body: passkeysResponse },
    { url: '/api/user/passkeys/passkey-1', method: 'DELETE', body: {} },
    { url: '/api/user/passkeys', method: 'GET', body: { passkeys: [] } },
  );
  const { screen, queryClient } = await renderProfileModal(
    <ManagePasskeysModal isOpen onAddNew={() => {}} onClose={() => {}} />,
  );
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

  await expect.element(screen.getByText('Laptop')).toBeVisible();
  await screen.getByLabelText('Delete').click();

  await expect.element(screen.getByText('Delete this passkey?')).toBeVisible();
  expect(fetchMock.requests).toHaveLength(1);

  await screen.getByRole('button', { name: 'Delete' }).click();

  await vi.waitFor(() => {
    expect(fetchMock.requests.length).toBeGreaterThanOrEqual(2);
  });

  const request = fetchMock.requests[1];
  expect(request).toEqual(
    expect.objectContaining({
      url: '/api/user/passkeys/passkey-1',
      method: 'DELETE',
    }),
  );
  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: getSessionQueryOptions.queryKey,
  });
  await expect.element(screen.getByTestId('passkeys-empty')).toBeVisible();
  await expect.element(screen.getByText('Laptop')).not.toBeInTheDocument();
  fetchMock.assertAllResponsesConsumed();
});

test('renders the preserved second-factor policy error when delete is rejected', async () => {
  const fetchMock = mockJsonResponses(
    { url: '/api/user/passkeys', method: 'GET', body: passkeysResponse },
    {
      url: '/api/user/passkeys/passkey-1',
      method: 'DELETE',
      body: {
        code: 'CANNOT_REMOVE_LAST_SECOND_FACTOR',
        message: 'Cannot remove last second factor',
      },
      init: { status: 400 },
    },
  );
  const { screen } = await renderProfileModal(
    <ManagePasskeysModal isOpen onAddNew={() => {}} onClose={() => {}} />,
  );

  await expect.element(screen.getByText('Laptop')).toBeVisible();
  await screen.getByLabelText('Delete').click();
  await screen.getByRole('button', { name: 'Delete' }).click();

  await expect
    .element(
      screen.getByText(
        'Cannot delete passkey. At least one two-factor authentication method (TOTP or Passkey) is required.',
      ),
    )
    .toBeVisible();
  fetchMock.assertAllResponsesConsumed();
});

test('closes the manage modal before opening passkey setup', async () => {
  mockJsonResponses({ body: { passkeys: [] } });
  const onClose = vi.fn();
  const onAddNew = vi.fn();
  const { screen } = await renderProfileModal(
    <ManagePasskeysModal isOpen onAddNew={onAddNew} onClose={onClose} />,
  );

  await screen.getByTestId('manage-passkeys-add-new').click();

  expect(onClose).toHaveBeenCalled();
  expect(onAddNew).toHaveBeenCalled();
});
