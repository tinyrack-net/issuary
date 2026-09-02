import { afterEach, describe, expect, test } from 'vitest';
import { IssuaryError } from '#frontend/libs/error.ts';
import {
  firstRequest,
  mockJsonError,
  mockJsonSuccess,
  mutationFunctionContext,
  queryFunctionContext,
  resetFetchMock,
} from '#frontend/test-utils/query-test-utils.ts';
import {
  getOAuthAuthorizeUrl,
  oauthAccountsQueryOptions,
  unlinkOAuthMutationOptions,
} from './oauth.ts';

const oauthAccountsResponse = {
  accounts: [
    {
      id: 'account-1',
      provider_name: 'google',
      provider_user_id: 'google-user-123',
      linked_at: '2026-05-14T10:00:00.000Z',
    },
  ],
  available_providers: [
    {
      id: 'google',
      display_name: 'Google',
      icon_url: 'https://example.com/google.svg',
      linked: true,
    },
    {
      id: 'github',
      display_name: 'GitHub',
      icon_url: null,
      linked: false,
    },
  ],
};

async function runOAuthAccountsQuery() {
  const queryFn = oauthAccountsQueryOptions.queryFn;

  if (typeof queryFn !== 'function') {
    throw new Error('Expected OAuth accounts queryFn to be defined');
  }

  return queryFn(queryFunctionContext(oauthAccountsQueryOptions.queryKey));
}

async function runUnlinkOAuthMutation(providerId: string) {
  const mutationFn = unlinkOAuthMutationOptions.mutationFn;

  if (typeof mutationFn !== 'function') {
    throw new Error('Expected unlink OAuth mutationFn to be defined');
  }

  return mutationFn(providerId, mutationFunctionContext());
}

describe('oauthAccountsQueryOptions', () => {
  afterEach(() => {
    resetFetchMock();
  });

  test('loads linked OAuth accounts from the expected endpoint', async () => {
    const fetchMock = mockJsonSuccess(oauthAccountsResponse);

    await expect(runOAuthAccountsQuery()).resolves.toEqual(
      oauthAccountsResponse,
    );

    const request = firstRequest(fetchMock.requests);

    expect(fetchMock.requests).toHaveLength(1);
    expect(request.url).toBe('/api/user/oauth-accounts');
    expect(request.method).toBe('GET');
    expect(request.headers.has('Accept-Language')).toBe(true);
  });

  test('preserves OAuth account load errors as IssuaryError', async () => {
    mockJsonError(
      {
        code: 'UNAUTHORIZED',
        message: 'Authentication is required.',
      },
      401,
    );

    try {
      await runOAuthAccountsQuery();
      throw new Error('Expected OAuth accounts query to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(IssuaryError);

      if (error instanceof IssuaryError) {
        expect(error.code).toBe('UNAUTHORIZED');
        expect(error.status).toBe(401);
        expect(error.message).toBe('Authentication is required.');
      }
    }
  });
});

describe('unlinkOAuthMutationOptions', () => {
  afterEach(() => {
    resetFetchMock();
  });

  test('deletes the selected provider link at the expected endpoint', async () => {
    const fetchMock = mockJsonSuccess({ ok: true });

    await expect(runUnlinkOAuthMutation('google')).resolves.toEqual({
      ok: true,
    });

    const request = firstRequest(fetchMock.requests);

    expect(fetchMock.requests).toHaveLength(1);
    expect(request.url).toBe('/api/oauth/google');
    expect(request.method).toBe('DELETE');
    expect(request.headers.has('Accept-Language')).toBe(true);
  });

  test('preserves unlink provider API errors as IssuaryError', async () => {
    mockJsonError(
      {
        code: 'OAUTH_ACCOUNT_NOT_LINKED',
        message: 'OAuth account is not linked.',
      },
      404,
    );

    try {
      await runUnlinkOAuthMutation('github');
      throw new Error('Expected unlink OAuth mutation to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(IssuaryError);

      if (error instanceof IssuaryError) {
        expect(error.code).toBe('OAUTH_ACCOUNT_NOT_LINKED');
        expect(error.status).toBe(404);
        expect(error.message).toBe('OAuth account is not linked.');
      }
    }
  });
});

describe('getOAuthAuthorizeUrl', () => {
  test('builds a login authorize URL with the provider, mode, and return URL', () => {
    const url = new URL(
      getOAuthAuthorizeUrl('google', 'login', '/login?client_id=web-client'),
      globalThis.location.origin,
    );

    expect(url.origin).toBe(globalThis.location.origin);
    expect(url.pathname).toBe('/api/oauth/google/authorize');
    expect(url.searchParams.get('mode')).toBe('login');
    expect(url.searchParams.get('return_url')).toBe(
      '/login?client_id=web-client',
    );
  });

  test('builds a link authorize URL for profile provider linking', () => {
    const url = new URL(
      getOAuthAuthorizeUrl('github', 'link', '/profile'),
      globalThis.location.origin,
    );

    expect(url.origin).toBe(globalThis.location.origin);
    expect(url.pathname).toBe('/api/oauth/github/authorize');
    expect(url.searchParams.get('mode')).toBe('link');
    expect(url.searchParams.get('return_url')).toBe('/profile');
  });
});
