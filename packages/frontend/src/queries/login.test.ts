import { afterEach, describe, expect, test } from 'vitest';
import { TinyAuthError } from '#frontend/libs/error.ts';
import {
  type CapturedFetchRequest,
  mockJsonError,
  mockJsonSuccess,
  mockNetworkError,
  mutationFunctionContext,
  resetFetchMock,
} from '#frontend/test-utils/query-test-utils.ts';
import { type LoginParams, loginMutationOptions } from './login.ts';

const loginValues = {
  email: 'user@example.com',
  password: 'correct-password',
} satisfies LoginParams;

const loginResponse = {
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

async function runLoginMutation(values: LoginParams) {
  const mutationFn = loginMutationOptions.mutationFn;

  if (typeof mutationFn !== 'function') {
    throw new Error('Expected login mutationFn to be defined');
  }

  return mutationFn(values, mutationFunctionContext());
}

function firstRequest(requests: CapturedFetchRequest[]) {
  const request = requests[0];

  if (!request) {
    throw new Error('Expected fetch to be called');
  }

  return request;
}

function jsonBody(request: CapturedFetchRequest) {
  if (typeof request.body !== 'string') {
    throw new Error('Expected request body to be serialized JSON');
  }

  return JSON.parse(request.body);
}

describe('loginMutationOptions', () => {
  afterEach(() => {
    resetFetchMock();
  });

  test('sends the expected login request and returns the success body', async () => {
    const fetchMock = mockJsonSuccess(loginResponse);

    await expect(runLoginMutation(loginValues)).resolves.toEqual(loginResponse);

    const request = firstRequest(fetchMock.requests);
    expect(fetchMock.requests).toHaveLength(1);
    expect(request.url).toBe('/api/auth/login');
    expect(request.method).toBe('POST');
    expect(request.headers.get('content-type')).toContain('application/json');
    expect(request.headers.has('Accept-Language')).toBe(true);
    expect(jsonBody(request)).toEqual(loginValues);
  });

  test('preserves API validation errors as TinyAuthError', async () => {
    mockJsonError(
      {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      },
      401,
    );

    try {
      await runLoginMutation(loginValues);
      throw new Error('Expected login mutation to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(TinyAuthError);

      if (error instanceof TinyAuthError) {
        expect(error.code).toBe('INVALID_CREDENTIALS');
        expect(error.status).toBe(401);
        expect(error.message).toBe('Invalid email or password.');
      }
    }
  });

  test('rejects with the original network failure', async () => {
    const networkError = new TypeError('Failed to fetch');
    mockNetworkError(networkError);

    await expect(runLoginMutation(loginValues)).rejects.toBe(networkError);
  });
});
