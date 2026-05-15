import { afterEach, expect, test, vi } from 'vitest';
import { getSessionQueryOptions } from '#frontend/queries/session.ts';
import { renderProfileModal } from '#frontend/test-utils/profile-modal-test-utils.tsx';
import {
  jsonRequestBody,
  mockJsonResponses,
  resetFetchMock,
} from '#frontend/test-utils/query-test-utils.ts';
import { SetupPasskeyModal } from './setup-passkey-modal.tsx';

const webauthnMocks = vi.hoisted(() => ({
  startAuthentication: vi.fn(),
  startRegistration: vi.fn(),
}));

vi.mock('@simplewebauthn/browser', () => ({
  startAuthentication: webauthnMocks.startAuthentication,
  startRegistration: webauthnMocks.startRegistration,
}));

afterEach(() => {
  resetFetchMock();
  webauthnMocks.startAuthentication.mockReset();
  webauthnMocks.startRegistration.mockReset();
});

test('registers a passkey, invalidates state, and closes', async () => {
  webauthnMocks.startRegistration.mockResolvedValue({
    id: 'credential-1',
    rawId: 'credential-1',
    response: {},
    type: 'public-key',
    clientExtensionResults: {},
  });
  const fetchMock = mockJsonResponses(
    {
      body: {
        options: {
          challenge: 'challenge-1',
        },
      },
    },
    { body: { ok: true } },
  );
  const onClose = vi.fn();
  const { screen, queryClient } = await renderProfileModal(
    <SetupPasskeyModal isOpen onClose={onClose} />,
  );
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

  await screen.getByPlaceholder('e.g., MacBook Pro, iPhone').fill('Laptop');
  await screen.getByRole('button', { name: 'Continue' }).click();

  await vi.waitFor(() => {
    expect(onClose).toHaveBeenCalled();
  });

  expect(fetchMock.requests[0]).toEqual(
    expect.objectContaining({
      url: '/api/user/passkeys/register/options',
      method: 'POST',
    }),
  );
  expect(fetchMock.requests[1]).toEqual(
    expect.objectContaining({
      url: '/api/user/passkeys/register/verify',
      method: 'POST',
    }),
  );
  expect(jsonRequestBody(fetchMock.requests[1])).toEqual({
    response: {
      id: 'credential-1',
      rawId: 'credential-1',
      response: {},
      type: 'public-key',
      clientExtensionResults: {},
    },
    name: 'Laptop',
  });
  expect(invalidateQueries).toHaveBeenCalledWith({
    queryKey: getSessionQueryOptions.queryKey,
  });
});

test('returns to the name step and shows a recoverable error on WebAuthn failure', async () => {
  webauthnMocks.startRegistration.mockRejectedValue(new Error('boom'));
  mockJsonResponses({
    body: {
      options: {
        challenge: 'challenge-1',
      },
    },
  });
  const { screen } = await renderProfileModal(
    <SetupPasskeyModal isOpen onClose={() => {}} />,
  );

  await screen.getByTestId('setup-passkey-continue').click();

  await expect
    .element(screen.getByText('Failed to register passkey. Please try again.'))
    .toBeVisible();
  await expect
    .element(screen.getByTestId('setup-passkey-continue'))
    .toBeVisible();
});

test('lets required setup switch to TOTP without closing', async () => {
  const onClose = vi.fn();
  const onSwitchToTotp = vi.fn();
  const { screen } = await renderProfileModal(
    <SetupPasskeyModal
      canSwitchToTotp
      isOpen
      isRequired
      onClose={onClose}
      onSwitchToTotp={onSwitchToTotp}
    />,
  );

  await screen.getByText('Use TOTP Instead').click();

  expect(onSwitchToTotp).toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
});
