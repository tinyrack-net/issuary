import { beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { IssuaryError } from '#frontend/libs/error.ts';
import { getSessionQueryOptions } from '#frontend/queries/session.ts';
import { initTestI18n } from '#frontend/test-utils/i18n.ts';
import { RegenerateTotpRecoveryCodesModal } from './regenerate-totp-recovery-codes-modal.tsx';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  invalidateQueries: vi.fn(async () => undefined),
  setQueryData: vi.fn(),
  reset: vi.fn(),
  mutation: {
    mutateAsync: vi.fn(),
    isPending: false,
    reset: vi.fn(),
  },
  totpEnabled: true,
}));

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    navigate: mocks.navigate,
  }),
}));

vi.mock('#frontend/components/totp/verify-step.js', async () => {
  const React = await import('react');

  return {
    VerifyStep: ({
      invalidMessage,
      onSubmit,
    }: {
      invalidMessage?: string | undefined;
      onSubmit: (code: string) => Promise<void>;
    }) => {
      const [errorMessage, setErrorMessage] = React.useState<string | null>(
        null,
      );

      return (
        <>
          <button
            data-testid="verify-submit"
            onClick={async () => {
              try {
                await onSubmit('123456');
              } catch {
                setErrorMessage(invalidMessage ?? 'invalid');
              }
            }}
            type="button"
          >
            verify
          </button>
          {errorMessage && (
            <div data-testid="verify-field-error">{errorMessage}</div>
          )}
        </>
      );
    },
  };
});

vi.mock('#frontend/components/totp/recovery-codes-step.js', () => ({
  RecoveryCodesStep: () => <div data-testid="recovery-codes-step">done</div>,
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query',
  );

  return {
    ...actual,
    useMutation: () => mocks.mutation,
    useQueryClient: () => ({
      invalidateQueries: mocks.invalidateQueries,
      setQueryData: mocks.setQueryData,
    }),
    useSuspenseQuery: () => ({
      data: {
        auth: {
          password: {
            totp: {
              enabled: mocks.totpEnabled,
            },
          },
        },
      },
    }),
  };
});

beforeAll(() => {
  initTestI18n();
});

beforeEach(() => {
  mocks.navigate.mockReset();
  mocks.invalidateQueries.mockReset();
  mocks.invalidateQueries.mockImplementation(async () => undefined);
  mocks.setQueryData.mockReset();
  mocks.reset.mockReset();
  mocks.mutation = {
    mutateAsync: vi.fn(),
    isPending: false,
    reset: mocks.reset,
  };
  mocks.totpEnabled = true;
});

async function fillVerificationCode(
  screen: Awaited<ReturnType<typeof render>>,
): Promise<void> {
  await screen.getByTestId('verify-submit').click();
}

test('shows a field error for invalid TOTP codes', async () => {
  mocks.mutation.mutateAsync = vi
    .fn()
    .mockRejectedValue(
      new IssuaryError('INVALID_TOTP_CODE', 400, 'Invalid code'),
    );

  const screen = await render(
    <RegenerateTotpRecoveryCodesModal isOpen onClose={() => {}} />,
  );

  await fillVerificationCode(screen);

  await expect
    .element(screen.getByText('Invalid code. Please try again.'))
    .toBeVisible();
  expect(
    screen.container.querySelector('[data-testid="alert-banner-error"]'),
  ).toBeNull();
});

test('redirects to login when the session is unauthorized', async () => {
  mocks.mutation.mutateAsync = vi
    .fn()
    .mockRejectedValue(new IssuaryError('UNAUTHORIZED', 401, 'Unauthorized'));

  const screen = await render(
    <RegenerateTotpRecoveryCodesModal isOpen onClose={() => {}} />,
  );

  await fillVerificationCode(screen);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(mocks.setQueryData).toHaveBeenCalledWith(
    getSessionQueryOptions.queryKey,
    {
      user: null,
    },
  );
  expect(mocks.navigate).toHaveBeenCalledWith({ to: '/login' });
});

test('shows a modal-level error for unexpected failures', async () => {
  mocks.mutation.mutateAsync = vi.fn().mockRejectedValue(new Error('boom'));

  const screen = await render(
    <RegenerateTotpRecoveryCodesModal isOpen onClose={() => {}} />,
  );

  await fillVerificationCode(screen);

  await expect
    .element(
      screen.getByText(
        'Unable to regenerate recovery codes right now. Please try again.',
      ),
    )
    .toBeVisible();
});

test('TOTP_NOT_ENABLED error closes modal and invalidates session', async () => {
  mocks.mutation.mutateAsync = vi
    .fn()
    .mockRejectedValue(
      new IssuaryError('TOTP_NOT_ENABLED', 400, 'TOTP not enabled'),
    );

  const onClose = vi.fn();
  const screen = await render(
    <RegenerateTotpRecoveryCodesModal isOpen onClose={onClose} />,
  );

  await fillVerificationCode(screen);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(mocks.invalidateQueries).toHaveBeenCalledWith({
    queryKey: getSessionQueryOptions.queryKey,
  });
  expect(onClose).toHaveBeenCalled();
});

test('TOTP disabled in config returns null', async () => {
  mocks.totpEnabled = false;

  const screen = await render(
    <RegenerateTotpRecoveryCodesModal isOpen onClose={() => {}} />,
  );

  expect(screen.container.innerHTML).toBe('');
});
