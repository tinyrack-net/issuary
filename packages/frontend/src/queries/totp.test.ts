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
  confirmTotpSetupMutationOptions,
  type DisableTotpParams,
  disableTotpMutationOptions,
  type RegenerateTotpRecoveryCodesParams,
  regenerateTotpRecoveryCodesMutationOptions,
  startTotpSetupMutationOptions,
  type VerifyRecoveryCodeParams,
  type VerifyTotpLoginParams,
  type VerifyTotpParams,
  verifyRecoveryCodeMutationOptions,
  verifyTotpLoginMutationOptions,
  verifyTotpMutationOptions,
} from './totp.ts';

const setupResponse = {
  secret: 'JBSWY3DPEHPK3PXP',
  qr_code_url: 'data:image/png;base64,totp-qr-code',
  otpauth_url: 'otpauth://totp/TinyAuth:user@example.com',
};

async function runStartTotpSetupMutation() {
  const mutationFn = startTotpSetupMutationOptions.mutationFn;

  if (typeof mutationFn !== 'function') {
    throw new Error('Expected start TOTP setup mutationFn to be defined');
  }

  return mutationFn(undefined, mutationFunctionContext());
}

async function runVerifyTotpMutation(values: VerifyTotpParams) {
  const mutationFn = verifyTotpMutationOptions.mutationFn;

  if (typeof mutationFn !== 'function') {
    throw new Error('Expected verify TOTP mutationFn to be defined');
  }

  return mutationFn(values, mutationFunctionContext());
}

async function runConfirmTotpSetupMutation() {
  const mutationFn = confirmTotpSetupMutationOptions.mutationFn;

  if (typeof mutationFn !== 'function') {
    throw new Error('Expected confirm TOTP setup mutationFn to be defined');
  }

  return mutationFn(undefined, mutationFunctionContext());
}

async function runDisableTotpMutation(values: DisableTotpParams) {
  const mutationFn = disableTotpMutationOptions.mutationFn;

  if (typeof mutationFn !== 'function') {
    throw new Error('Expected disable TOTP mutationFn to be defined');
  }

  return mutationFn(values, mutationFunctionContext());
}

async function runRegenerateTotpRecoveryCodesMutation(
  values: RegenerateTotpRecoveryCodesParams,
) {
  const mutationFn = regenerateTotpRecoveryCodesMutationOptions.mutationFn;

  if (typeof mutationFn !== 'function') {
    throw new Error(
      'Expected regenerate TOTP recovery mutationFn to be defined',
    );
  }

  return mutationFn(values, mutationFunctionContext());
}

async function runVerifyTotpLoginMutation(values: VerifyTotpLoginParams) {
  const mutationFn = verifyTotpLoginMutationOptions.mutationFn;

  if (typeof mutationFn !== 'function') {
    throw new Error('Expected verify TOTP login mutationFn to be defined');
  }

  return mutationFn(values, mutationFunctionContext());
}

async function runVerifyRecoveryCodeMutation(values: VerifyRecoveryCodeParams) {
  const mutationFn = verifyRecoveryCodeMutationOptions.mutationFn;

  if (typeof mutationFn !== 'function') {
    throw new Error('Expected verify recovery code mutationFn to be defined');
  }

  return mutationFn(values, mutationFunctionContext());
}

describe('TOTP setup mutations', () => {
  afterEach(() => {
    resetFetchMock();
  });

  test('starts setup at the expected endpoint', async () => {
    const fetchMock = mockJsonSuccess(setupResponse);

    await expect(runStartTotpSetupMutation()).resolves.toEqual(setupResponse);

    const request = firstRequest(fetchMock.requests);
    expect(request.url).toBe('/api/user/totp/setup');
    expect(request.method).toBe('POST');
    expect(request.headers.has('Accept-Language')).toBe(true);
  });

  test('verifies setup code and preserves recovery codes', async () => {
    const verifyResponse = { recovery_codes: ['code-1', 'code-2'] };
    const values = { code: '123456' } satisfies VerifyTotpParams;
    const fetchMock = mockJsonSuccess(verifyResponse);

    await expect(runVerifyTotpMutation(values)).resolves.toEqual(
      verifyResponse,
    );

    const request = firstRequest(fetchMock.requests);
    expect(request.url).toBe('/api/user/totp/verify');
    expect(request.method).toBe('POST');
    expect(request.headers.get('content-type')).toContain('application/json');
    expect(jsonRequestBody(request)).toEqual(values);
  });

  test('confirms setup with an empty JSON body', async () => {
    const fetchMock = mockJsonSuccess({ ok: true });

    await expect(runConfirmTotpSetupMutation()).resolves.toEqual({ ok: true });

    const request = firstRequest(fetchMock.requests);
    expect(request.url).toBe('/api/user/totp/confirm');
    expect(request.method).toBe('POST');
    expect(request.headers.get('content-type')).toContain('application/json');
    expect(jsonRequestBody(request)).toEqual({});
  });
});

describe('TOTP profile mutations', () => {
  afterEach(() => {
    resetFetchMock();
  });

  test('disables TOTP with the supplied verification code', async () => {
    const values = { code: '654321' } satisfies DisableTotpParams;
    const fetchMock = mockJsonSuccess({ ok: true });

    await expect(runDisableTotpMutation(values)).resolves.toEqual({ ok: true });

    const request = firstRequest(fetchMock.requests);
    expect(request.url).toBe('/api/user/totp');
    expect(request.method).toBe('DELETE');
    expect(request.headers.get('content-type')).toContain('application/json');
    expect(jsonRequestBody(request)).toEqual(values);
  });

  test('regenerates recovery codes with the expected verification body', async () => {
    const values = {
      code: '654321',
    } satisfies RegenerateTotpRecoveryCodesParams;
    const response = { recovery_codes: ['new-code-1', 'new-code-2'] };
    const fetchMock = mockJsonSuccess(response);

    await expect(
      runRegenerateTotpRecoveryCodesMutation(values),
    ).resolves.toEqual(response);

    const request = firstRequest(fetchMock.requests);
    expect(request.url).toBe('/api/user/totp/recovery/regenerate');
    expect(request.method).toBe('POST');
    expect(jsonRequestBody(request)).toEqual(values);
  });

  test('preserves profile TOTP API errors as TinyAuthError', async () => {
    mockJsonError(
      {
        code: 'INVALID_TOTP_CODE',
        message: 'Invalid authentication code.',
      },
      400,
    );

    try {
      await runDisableTotpMutation({ code: '000000' });
      throw new Error('Expected disable TOTP mutation to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(TinyAuthError);

      if (error instanceof TinyAuthError) {
        expect(error.code).toBe('INVALID_TOTP_CODE');
        expect(error.status).toBe(400);
        expect(error.message).toBe('Invalid authentication code.');
      }
    }
  });
});

describe('TOTP login mutations', () => {
  afterEach(() => {
    resetFetchMock();
  });

  test('verifies a login TOTP code against the auth endpoint', async () => {
    const values = { code: '123456' } satisfies VerifyTotpLoginParams;
    const response = { user: { sub: 'user_123', email: 'user@example.com' } };
    const fetchMock = mockJsonSuccess(response);

    await expect(runVerifyTotpLoginMutation(values)).resolves.toEqual(response);

    const request = firstRequest(fetchMock.requests);
    expect(request.url).toBe('/api/auth/totp/verify');
    expect(request.method).toBe('POST');
    expect(jsonRequestBody(request)).toEqual(values);
  });

  test('verifies a recovery code against the auth endpoint', async () => {
    const values = {
      code: 'abcd-efgh',
    } satisfies VerifyRecoveryCodeParams;
    const response = { user: { sub: 'user_123', email: 'user@example.com' } };
    const fetchMock = mockJsonSuccess(response);

    await expect(runVerifyRecoveryCodeMutation(values)).resolves.toEqual(
      response,
    );

    const request = firstRequest(fetchMock.requests);
    expect(request.url).toBe('/api/auth/totp/recovery/verify');
    expect(request.method).toBe('POST');
    expect(jsonRequestBody(request)).toEqual(values);
  });
});
