import { afterEach, describe, expect, test } from 'vitest';
import { IssuaryError } from '#frontend/libs/error.ts';
import {
  firstRequest,
  jsonRequestBody,
  mockJsonError,
  mockJsonSuccess,
  mutationFunctionContext,
  resetFetchMock,
} from '#frontend/test-utils/query-test-utils.ts';
import {
  type ForgotPasswordParams,
  forgotPasswordMutationOptions,
  type ResetPasswordParams,
  resetPasswordMutationOptions,
} from './password-reset.ts';

const forgotPasswordValues = {
  email: 'user@example.com',
} satisfies ForgotPasswordParams;

const resetPasswordValues = {
  token: 'reset-token-123',
  password: 'new-secure-password',
} satisfies ResetPasswordParams;

async function runForgotPasswordMutation(values: ForgotPasswordParams) {
  const mutationFn = forgotPasswordMutationOptions.mutationFn;

  if (typeof mutationFn !== 'function') {
    throw new Error('Expected forgot password mutationFn to be defined');
  }

  return mutationFn(values, mutationFunctionContext());
}

async function runResetPasswordMutation(values: ResetPasswordParams) {
  const mutationFn = resetPasswordMutationOptions.mutationFn;

  if (typeof mutationFn !== 'function') {
    throw new Error('Expected reset password mutationFn to be defined');
  }

  return mutationFn(values, mutationFunctionContext());
}

describe('forgotPasswordMutationOptions', () => {
  afterEach(() => {
    resetFetchMock();
  });

  test('sends only the email to the forgot password endpoint', async () => {
    const fetchMock = mockJsonSuccess({ ok: true });

    await expect(
      runForgotPasswordMutation(forgotPasswordValues),
    ).resolves.toEqual({ ok: true });

    const request = firstRequest(fetchMock.requests);
    expect(fetchMock.requests).toHaveLength(1);
    expect(request.url).toBe('/api/auth/password/forgot');
    expect(request.method).toBe('POST');
    expect(request.headers.get('content-type')).toContain('application/json');
    expect(request.headers.has('Accept-Language')).toBe(true);
    expect(jsonRequestBody(request)).toEqual({ email: 'user@example.com' });
  });
});

describe('resetPasswordMutationOptions', () => {
  afterEach(() => {
    resetFetchMock();
  });

  test('sends the reset token and new password to the reset endpoint', async () => {
    const resetResponse = {
      message: 'Password has been reset successfully.',
    };
    const fetchMock = mockJsonSuccess(resetResponse);

    await expect(
      runResetPasswordMutation(resetPasswordValues),
    ).resolves.toEqual(resetResponse);

    const request = firstRequest(fetchMock.requests);
    expect(fetchMock.requests).toHaveLength(1);
    expect(request.url).toBe('/api/auth/password/reset');
    expect(request.method).toBe('POST');
    expect(request.headers.get('content-type')).toContain('application/json');
    expect(request.headers.has('Accept-Language')).toBe(true);
    expect(jsonRequestBody(request)).toEqual(resetPasswordValues);
  });

  test('preserves invalid reset token API errors as IssuaryError', async () => {
    mockJsonError(
      {
        code: 'INVALID_PASSWORD_RESET_TOKEN',
        message: 'The password reset token is invalid or has expired.',
      },
      400,
    );

    try {
      await runResetPasswordMutation(resetPasswordValues);
      throw new Error('Expected reset password mutation to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(IssuaryError);

      if (error instanceof IssuaryError) {
        expect(error.code).toBe('INVALID_PASSWORD_RESET_TOKEN');
        expect(error.status).toBe(400);
        expect(error.message).toBe(
          'The password reset token is invalid or has expired.',
        );
      }
    }
  });
});
