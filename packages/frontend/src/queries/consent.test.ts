import { afterEach, describe, expect, test } from 'vitest';
import { TinyAuthError } from '#frontend/libs/error.ts';
import {
  firstRequest,
  jsonRequestBody,
  mockJsonError,
  mockJsonSuccess,
  mutationFunctionContext,
  queryFunctionContext,
  resetFetchMock,
} from '#frontend/test-utils/query-test-utils.ts';
import {
  type ConsentDecisionParams,
  type ConsentInfoParams,
  consentDecisionMutationOptions,
  getConsentInfoQueryOptions,
} from './consent.ts';

const consentInfoParams = {
  client_id: 'web-client',
  scope: 'openid profile email',
} satisfies ConsentInfoParams;

const consentInfoResponse = {
  client: {
    id: 'client-pk',
    clientId: 'web-client',
    name: 'Web Client',
  },
  scopes: [
    {
      name: 'openid',
      description: 'Access your unique user identifier',
    },
    {
      name: 'profile',
      description: 'Access your profile information',
    },
    {
      name: 'email',
      description: 'Access your email address',
    },
  ],
  user: {
    sub: 'user_123',
    email: 'user@example.com',
  },
};

const approveDecisionParams = {
  client_id: 'web-client',
  redirect_uri: 'https://client.example.com/callback?existing=1',
  response_type: 'code',
  scope: 'openid profile email',
  state: 'oauth-state-123',
  nonce: 'nonce-456',
  code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  code_challenge_method: 'S256',
  decision: 'allow',
} satisfies ConsentDecisionParams;

const denyDecisionParams = {
  client_id: 'web-client',
  redirect_uri: 'https://client.example.com/callback',
  response_type: 'code',
  scope: 'openid profile',
  state: 'oauth-state-456',
  decision: 'deny',
} satisfies ConsentDecisionParams;

async function runConsentInfoQuery(params: ConsentInfoParams) {
  const queryOptions = getConsentInfoQueryOptions(params);

  if (typeof queryOptions.queryFn !== 'function') {
    throw new Error('Expected consent info queryFn to be defined');
  }

  return queryOptions.queryFn(queryFunctionContext(queryOptions.queryKey));
}

async function runConsentDecisionMutation(values: ConsentDecisionParams) {
  const mutationFn = consentDecisionMutationOptions.mutationFn;

  if (typeof mutationFn !== 'function') {
    throw new Error('Expected consent decision mutationFn to be defined');
  }

  return mutationFn(values, mutationFunctionContext());
}

describe('getConsentInfoQueryOptions', () => {
  afterEach(() => {
    resetFetchMock();
  });

  test('loads consent details with the expected client and scope search params', async () => {
    const fetchMock = mockJsonSuccess(consentInfoResponse);

    await expect(runConsentInfoQuery(consentInfoParams)).resolves.toEqual(
      consentInfoResponse,
    );

    const request = firstRequest(fetchMock.requests);
    const url = new URL(request.url, globalThis.location.origin);

    expect(fetchMock.requests).toHaveLength(1);
    expect(url.pathname).toBe('/api/consent');
    expect(url.searchParams.get('client_id')).toBe('web-client');
    expect(url.searchParams.get('scope')).toBe('openid profile email');
    expect(request.method).toBe('GET');
    expect(request.headers.has('Accept-Language')).toBe(true);
  });

  test('preserves invalid OAuth session errors as TinyAuthError', async () => {
    mockJsonError(
      {
        code: 'UNAUTHORIZED',
        message: 'Authentication is required.',
      },
      401,
    );

    try {
      await runConsentInfoQuery(consentInfoParams);
      throw new Error('Expected consent info query to reject');
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

describe('consentDecisionMutationOptions', () => {
  afterEach(() => {
    resetFetchMock();
  });

  test('posts the full approve decision payload and returns the continuation URL', async () => {
    const decisionResponse = {
      redirect_url:
        'https://auth.example.com/oauth/authorize?client_id=web-client&state=oauth-state-123',
    };
    const fetchMock = mockJsonSuccess(decisionResponse);

    await expect(
      runConsentDecisionMutation(approveDecisionParams),
    ).resolves.toEqual(decisionResponse);

    const request = firstRequest(fetchMock.requests);

    expect(fetchMock.requests).toHaveLength(1);
    expect(request.url).toBe('/api/consent');
    expect(request.method).toBe('POST');
    expect(request.headers.get('content-type')).toContain('application/json');
    expect(request.headers.has('Accept-Language')).toBe(true);
    expect(jsonRequestBody(request)).toEqual(approveDecisionParams);
  });

  test('posts the deny decision payload without dropping OAuth continuation state', async () => {
    const decisionResponse = {
      redirect_url:
        'https://client.example.com/callback?error=access_denied&state=oauth-state-456',
    };
    const fetchMock = mockJsonSuccess(decisionResponse);

    await expect(
      runConsentDecisionMutation(denyDecisionParams),
    ).resolves.toEqual(decisionResponse);

    const request = firstRequest(fetchMock.requests);

    expect(request.url).toBe('/api/consent');
    expect(request.method).toBe('POST');
    expect(jsonRequestBody(request)).toEqual(denyDecisionParams);
  });

  test('preserves invalid consent API errors as TinyAuthError', async () => {
    mockJsonError(
      {
        code: 'OAUTH_CLIENT_NOT_FOUND',
        message: 'OAuth client was not found.',
      },
      400,
    );

    try {
      await runConsentDecisionMutation(approveDecisionParams);
      throw new Error('Expected consent decision mutation to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(TinyAuthError);

      if (error instanceof TinyAuthError) {
        expect(error.code).toBe('OAUTH_CLIENT_NOT_FOUND');
        expect(error.status).toBe(400);
        expect(error.message).toBe('OAuth client was not found.');
      }
    }
  });
});
