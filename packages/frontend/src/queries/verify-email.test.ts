import { afterEach, describe, expect, test } from 'vitest';
import { TinyAuthError } from '#frontend/libs/error.ts';
import {
  firstRequest,
  jsonRequestBody,
  mockJsonError,
  mockJsonSuccess,
  mutationFunctionContext,
  resetFetchMock,
} from '#frontend/test-utils/query-test-utils.ts';
import {
  type ResendVerificationParams,
  resendVerificationMutationOptions,
  type VerifyEmailParams,
  verifyEmailMutationOptions,
} from './verify-email.ts';

const verifyEmailValues = {
  token: 'verify-token-123',
} satisfies VerifyEmailParams;

const resendVerificationValues = {
  email: 'user@example.com',
} satisfies ResendVerificationParams;

const authResponse = {
  user: {
    managed_by: 'database',
    sub: 'user_123',
    email: 'user@example.com',
    email_verified: true,
    email_verification_required: false,
    has_password: true,
    totp_registered: false,
    totp_recovery_codes_missing: false,
    second_factor_required: false,
    passkey_count: 0,
  },
};

async function runVerifyEmailMutation(values: VerifyEmailParams) {
  const mutationFn = verifyEmailMutationOptions.mutationFn;

  if (typeof mutationFn !== 'function') {
    throw new Error('Expected verify email mutationFn to be defined');
  }

  return mutationFn(values, mutationFunctionContext());
}

async function runResendVerificationMutation(values: ResendVerificationParams) {
  const mutationFn = resendVerificationMutationOptions.mutationFn;

  if (typeof mutationFn !== 'function') {
    throw new Error('Expected resend verification mutationFn to be defined');
  }

  return mutationFn(values, mutationFunctionContext());
}

describe('verifyEmailMutationOptions', () => {
  afterEach(() => {
    resetFetchMock();
  });

  test('sends the verification token to the verify email endpoint', async () => {
    const fetchMock = mockJsonSuccess(authResponse);

    await expect(runVerifyEmailMutation(verifyEmailValues)).resolves.toEqual(
      authResponse,
    );

    const request = firstRequest(fetchMock.requests);
    expect(fetchMock.requests).toHaveLength(1);
    expect(request.url).toBe('/api/auth/email/verify');
    expect(request.method).toBe('POST');
    expect(request.headers.get('content-type')).toContain('application/json');
    expect(request.headers.has('Accept-Language')).toBe(true);
    expect(jsonRequestBody(request)).toEqual(verifyEmailValues);
  });

  test('preserves invalid verification token API errors as TinyAuthError', async () => {
    mockJsonError(
      {
        code: 'INVALID_VERIFICATION_TOKEN',
        message: 'The verification token is invalid or has expired.',
      },
      400,
    );

    try {
      await runVerifyEmailMutation(verifyEmailValues);
      throw new Error('Expected verify email mutation to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(TinyAuthError);

      if (error instanceof TinyAuthError) {
        expect(error.code).toBe('INVALID_VERIFICATION_TOKEN');
        expect(error.status).toBe(400);
        expect(error.message).toBe(
          'The verification token is invalid or has expired.',
        );
      }
    }
  });
});

describe('resendVerificationMutationOptions', () => {
  afterEach(() => {
    resetFetchMock();
  });

  test('sends the email to the resend verification endpoint', async () => {
    const resendResponse = {
      message: 'Verification email has been resent. Please check your inbox.',
    };
    const fetchMock = mockJsonSuccess(resendResponse);

    await expect(
      runResendVerificationMutation(resendVerificationValues),
    ).resolves.toEqual(resendResponse);

    const request = firstRequest(fetchMock.requests);
    expect(fetchMock.requests).toHaveLength(1);
    expect(request.url).toBe('/api/auth/email/resend');
    expect(request.method).toBe('POST');
    expect(request.headers.get('content-type')).toContain('application/json');
    expect(request.headers.has('Accept-Language')).toBe(true);
    expect(jsonRequestBody(request)).toEqual(resendVerificationValues);
  });

  test('preserves resend verification API errors as TinyAuthError', async () => {
    mockJsonError(
      {
        code: 'EMAIL_ALREADY_VERIFIED',
        message: 'Email is already verified.',
      },
      400,
    );

    try {
      await runResendVerificationMutation(resendVerificationValues);
      throw new Error('Expected resend verification mutation to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(TinyAuthError);

      if (error instanceof TinyAuthError) {
        expect(error.code).toBe('EMAIL_ALREADY_VERIFIED');
        expect(error.status).toBe(400);
        expect(error.message).toBe('Email is already verified.');
      }
    }
  });
});
