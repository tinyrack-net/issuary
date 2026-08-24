import { afterEach, describe, expect, test } from 'vitest';
import { IssuaryError } from '#frontend/libs/error.ts';
import {
  type CapturedFetchRequest,
  mockJsonError,
  mockJsonSuccess,
  mockNetworkError,
  mutationFunctionContext,
  resetFetchMock,
} from '#frontend/test-utils/query-test-utils.ts';
import { type RegisterParams, registerMutationOptions } from './register.ts';

const registerValues = {
  email: 'new-user@example.com',
  password: 'correct-password',
  consents: [
    {
      termsId: 'terms-of-service',
      agreed: true,
      consentType: 'explicit',
    },
  ],
} satisfies RegisterParams;

const registerResponse = {
  user: {
    managed_by: 'database',
    sub: 'user_456',
    email: 'new-user@example.com',
    email_verified: false,
    email_verification_required: true,
    has_password: true,
    totp_registered: false,
    totp_recovery_codes_missing: false,
    second_factor_required: false,
    passkey_count: 0,
  },
};

async function runRegisterMutation(values: RegisterParams) {
  const mutationFn = registerMutationOptions.mutationFn;

  if (typeof mutationFn !== 'function') {
    throw new Error('Expected register mutationFn to be defined');
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

describe('registerMutationOptions', () => {
  afterEach(() => {
    resetFetchMock();
  });

  test('sends the expected register request and returns the success body', async () => {
    const fetchMock = mockJsonSuccess(registerResponse);

    await expect(runRegisterMutation(registerValues)).resolves.toEqual(
      registerResponse,
    );

    const request = firstRequest(fetchMock.requests);
    expect(fetchMock.requests).toHaveLength(1);
    expect(request.url).toBe('/api/auth/register');
    expect(request.method).toBe('POST');
    expect(request.headers.get('content-type')).toContain('application/json');
    expect(request.headers.has('Accept-Language')).toBe(true);
    expect(jsonBody(request)).toEqual(registerValues);
  });

  test('preserves duplicate registration API errors as IssuaryError', async () => {
    mockJsonError(
      {
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'The provided email is already registered.',
      },
      409,
    );

    try {
      await runRegisterMutation(registerValues);
      throw new Error('Expected register mutation to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(IssuaryError);

      if (error instanceof IssuaryError) {
        expect(error.code).toBe('EMAIL_ALREADY_REGISTERED');
        expect(error.status).toBe(409);
        expect(error.message).toBe('The provided email is already registered.');
      }
    }
  });

  test('rejects with the original network failure', async () => {
    const networkError = new TypeError('Failed to fetch');
    mockNetworkError(networkError);

    await expect(runRegisterMutation(registerValues)).rejects.toBe(
      networkError,
    );
  });
});
