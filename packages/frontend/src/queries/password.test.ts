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
  type ChangePasswordParams,
  changePasswordMutationOptions,
  type RemovePasswordParams,
  removePasswordMutationOptions,
  type SetPasswordParams,
  setPasswordMutationOptions,
} from './password.ts';

async function runSetPasswordMutation(values: SetPasswordParams) {
  const mutationFn = setPasswordMutationOptions.mutationFn;

  if (typeof mutationFn !== 'function') {
    throw new Error('Expected set password mutationFn to be defined');
  }

  return mutationFn(values, mutationFunctionContext());
}

async function runChangePasswordMutation(values: ChangePasswordParams) {
  const mutationFn = changePasswordMutationOptions.mutationFn;

  if (typeof mutationFn !== 'function') {
    throw new Error('Expected change password mutationFn to be defined');
  }

  return mutationFn(values, mutationFunctionContext());
}

async function runRemovePasswordMutation(values: RemovePasswordParams) {
  const mutationFn = removePasswordMutationOptions.mutationFn;

  if (typeof mutationFn !== 'function') {
    throw new Error('Expected remove password mutationFn to be defined');
  }

  return mutationFn(values, mutationFunctionContext());
}

describe('password profile mutations', () => {
  afterEach(() => {
    resetFetchMock();
  });

  test('sets a password with the expected endpoint and body', async () => {
    const values = { password: 'newPassword123!' } satisfies SetPasswordParams;
    const fetchMock = mockJsonSuccess({ ok: true });

    await expect(runSetPasswordMutation(values)).resolves.toEqual({ ok: true });

    const request = firstRequest(fetchMock.requests);
    expect(request.url).toBe('/api/user/password');
    expect(request.method).toBe('POST');
    expect(request.headers.get('content-type')).toContain('application/json');
    expect(request.headers.has('Accept-Language')).toBe(true);
    expect(jsonRequestBody(request)).toEqual(values);
  });

  test('changes a password with current and new password fields', async () => {
    const values = {
      current_password: 'oldPassword123!',
      new_password: 'newPassword123!',
    } satisfies ChangePasswordParams;
    const fetchMock = mockJsonSuccess({ ok: true });

    await expect(runChangePasswordMutation(values)).resolves.toEqual({
      ok: true,
    });

    const request = firstRequest(fetchMock.requests);
    expect(request.url).toBe('/api/user/password');
    expect(request.method).toBe('PUT');
    expect(request.headers.get('content-type')).toContain('application/json');
    expect(jsonRequestBody(request)).toEqual(values);
  });

  test('removes a password with the current password body', async () => {
    const values = {
      current_password: 'currentPassword123!',
    } satisfies RemovePasswordParams;
    const fetchMock = mockJsonSuccess({ ok: true });

    await expect(runRemovePasswordMutation(values)).resolves.toEqual({
      ok: true,
    });

    const request = firstRequest(fetchMock.requests);
    expect(request.url).toBe('/api/user/password');
    expect(request.method).toBe('DELETE');
    expect(request.headers.get('content-type')).toContain('application/json');
    expect(jsonRequestBody(request)).toEqual(values);
  });

  test('preserves password mutation API errors as IssuaryError', async () => {
    mockJsonError(
      {
        code: 'INVALID_CURRENT_PASSWORD',
        message: 'Current password is incorrect.',
      },
      401,
    );

    try {
      await runChangePasswordMutation({
        current_password: 'wrongPassword123!',
        new_password: 'newPassword123!',
      });
      throw new Error('Expected change password mutation to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(IssuaryError);

      if (error instanceof IssuaryError) {
        expect(error.code).toBe('INVALID_CURRENT_PASSWORD');
        expect(error.status).toBe(401);
        expect(error.message).toBe('Current password is incorrect.');
      }
    }
  });
});
