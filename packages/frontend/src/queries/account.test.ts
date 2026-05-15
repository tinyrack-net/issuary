import { afterEach, describe, expect, test } from 'vitest';
import { TinyAuthError } from '#frontend/libs/error.ts';
import {
  firstRequest,
  mockJsonError,
  mockJsonSuccess,
  mutationFunctionContext,
  queryFunctionContext,
  resetFetchMock,
} from '#frontend/test-utils/query-test-utils.ts';
import { deleteAccountMutationOptions } from './account.ts';
import { getSessionQueryOptions } from './session.ts';

const sessionResponse = {
  user: {
    managed_by: 'database',
    sub: 'user_123',
    email: 'user@example.com',
    email_verified: true,
    email_verification_required: false,
    has_password: true,
    totp_registered: true,
    totp_recovery_codes_missing: false,
    second_factor_required: true,
    passkey_count: 2,
  },
};

async function runSessionQuery() {
  const queryFn = getSessionQueryOptions.queryFn;

  if (typeof queryFn !== 'function') {
    throw new Error('Expected session queryFn to be defined');
  }

  return queryFn(queryFunctionContext(getSessionQueryOptions.queryKey));
}

async function runDeleteAccountMutation() {
  const mutationFn = deleteAccountMutationOptions.mutationFn;

  if (typeof mutationFn !== 'function') {
    throw new Error('Expected delete account mutationFn to be defined');
  }

  return mutationFn(undefined, mutationFunctionContext());
}

describe('getSessionQueryOptions', () => {
  afterEach(() => {
    resetFetchMock();
  });

  test('loads the current profile session from the expected endpoint', async () => {
    const fetchMock = mockJsonSuccess(sessionResponse);

    await expect(runSessionQuery()).resolves.toEqual(sessionResponse);

    const request = firstRequest(fetchMock.requests);
    expect(fetchMock.requests).toHaveLength(1);
    expect(request.url).toBe('/api/user/session');
    expect(request.method).toBe('GET');
    expect(request.headers.has('Accept-Language')).toBe(true);
  });

  test('preserves unauthenticated session errors as TinyAuthError', async () => {
    mockJsonError(
      {
        code: 'UNAUTHORIZED',
        message: 'Authentication is required.',
      },
      401,
    );

    try {
      await runSessionQuery();
      throw new Error('Expected session query to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(TinyAuthError);

      if (error instanceof TinyAuthError) {
        expect(error.code).toBe('UNAUTHORIZED');
        expect(error.status).toBe(401);
        expect(error.message).toBe('Authentication is required.');
      }
    }
  });
});

describe('deleteAccountMutationOptions', () => {
  afterEach(() => {
    resetFetchMock();
  });

  test('deletes the current account at the expected endpoint', async () => {
    const fetchMock = mockJsonSuccess({ ok: true });

    await expect(runDeleteAccountMutation()).resolves.toEqual({ ok: true });

    const request = firstRequest(fetchMock.requests);
    expect(fetchMock.requests).toHaveLength(1);
    expect(request.url).toBe('/api/user');
    expect(request.method).toBe('DELETE');
    expect(request.headers.has('Accept-Language')).toBe(true);
  });

  test('preserves account deletion API errors as TinyAuthError', async () => {
    mockJsonError(
      {
        code: 'ACCOUNT_DELETE_FORBIDDEN',
        message: 'Account deletion is not allowed.',
      },
      403,
    );

    try {
      await runDeleteAccountMutation();
      throw new Error('Expected delete account mutation to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(TinyAuthError);

      if (error instanceof TinyAuthError) {
        expect(error.code).toBe('ACCOUNT_DELETE_FORBIDDEN');
        expect(error.status).toBe(403);
        expect(error.message).toBe('Account deletion is not allowed.');
      }
    }
  });
});
