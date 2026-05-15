import { afterEach, expect, test, vi } from 'vitest';
import { renderProfileModal } from '#frontend/test-utils/profile-modal-test-utils.tsx';
import {
  jsonRequestBody,
  mockJsonResponses,
  resetFetchMock,
} from '#frontend/test-utils/query-test-utils.ts';
import { SetupTotpModal } from './setup-totp-modal.tsx';

afterEach(() => {
  resetFetchMock();
});

async function fillTotpCode(
  screen: Awaited<ReturnType<typeof renderProfileModal>>['screen'],
  code: string,
): Promise<void> {
  const digits = code.split('');

  for (const [index, digit] of digits.entries()) {
    await screen.getByLabelText(`Digit ${index + 1} of 6`).fill(digit);
  }
}

test('walks through TOTP setup, recovery confirmation, and close', async () => {
  const fetchMock = mockJsonResponses(
    {
      body: {
        qr_code: 'data:image/png;base64,qr',
        secret: 'SECRET123',
      },
    },
    {
      body: {
        recovery_codes: ['alpha-1', 'bravo-2'],
      },
    },
    { body: { ok: true } },
  );
  const onClose = vi.fn();
  const { screen } = await renderProfileModal(
    <SetupTotpModal isOpen onClose={onClose} />,
  );

  await expect.element(screen.getByAltText('TOTP QR Code')).toBeVisible();
  await screen.getByTestId('totp-qr-next').click();
  await fillTotpCode(screen, '123456');

  await expect.element(screen.getByText('alpha-1')).toBeVisible();
  await screen.getByTestId('recovery-codes-confirm').click();
  await screen.getByTestId('recovery-codes-submit').click();

  await vi.waitFor(() => {
    expect(onClose).toHaveBeenCalled();
  });

  expect(fetchMock.requests[0]).toEqual(
    expect.objectContaining({
      url: '/api/user/totp/setup',
      method: 'POST',
    }),
  );
  expect(fetchMock.requests[1]).toEqual(
    expect.objectContaining({
      url: '/api/user/totp/verify',
      method: 'POST',
    }),
  );
  expect(jsonRequestBody(fetchMock.requests[1])).toEqual({ code: '123456' });
  expect(fetchMock.requests[2]).toEqual(
    expect.objectContaining({
      url: '/api/user/totp/confirm',
      method: 'POST',
    }),
  );
});

test('shows setup error state and retries setup', async () => {
  const fetchMock = mockJsonResponses(
    {
      body: {
        code: 'SETUP_FAILED',
        message: 'Setup failed',
      },
      init: { status: 500 },
    },
    {
      body: {
        qr_code: 'data:image/png;base64,qr',
        secret: 'SECRET123',
      },
    },
  );
  const { screen } = await renderProfileModal(
    <SetupTotpModal isOpen onClose={() => {}} />,
  );

  await expect
    .element(screen.getByText('Failed to start setup. Please try again.'))
    .toBeVisible();
  await screen.getByText('Retry').click();

  await expect.element(screen.getByAltText('TOTP QR Code')).toBeVisible();
  expect(fetchMock.requests).toHaveLength(2);
});

test('lets required setup switch to passkey from the QR step', async () => {
  mockJsonResponses({
    body: {
      qr_code: 'data:image/png;base64,qr',
      secret: 'SECRET123',
    },
  });
  const onClose = vi.fn();
  const onSwitchToPasskey = vi.fn();
  const { screen } = await renderProfileModal(
    <SetupTotpModal
      canSwitchToPasskey
      isOpen
      isRequired
      onClose={onClose}
      onSwitchToPasskey={onSwitchToPasskey}
    />,
  );

  await expect.element(screen.getByAltText('TOTP QR Code')).toBeVisible();
  await screen.getByText('Use Passkey Instead').click();

  expect(onSwitchToPasskey).toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
});

test('keeps the user on verification when the TOTP code is invalid', async () => {
  mockJsonResponses(
    {
      body: {
        qr_code: 'data:image/png;base64,qr',
        secret: 'SECRET123',
      },
    },
    {
      body: {
        code: 'INVALID_TOTP_CODE',
        message: 'Invalid code',
      },
      init: { status: 400 },
    },
  );
  const { screen } = await renderProfileModal(
    <SetupTotpModal isOpen onClose={() => {}} />,
  );

  await expect.element(screen.getByAltText('TOTP QR Code')).toBeVisible();
  await screen.getByTestId('totp-qr-next').click();
  await fillTotpCode(screen, '123456');

  await expect
    .element(screen.getByText('Invalid code. Please try again.'))
    .toBeVisible();
});
