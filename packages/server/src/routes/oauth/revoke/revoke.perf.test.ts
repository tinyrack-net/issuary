import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '../../../entrypoints/app.js';
import type { TinyAuthRuntimeConfigInput } from '../../../lib/config/index.js';
import {
  assertJsonBody,
  createAuthenticatedSession,
  createTestApp,
  getAccessToken,
  getAuthorizationCode,
  MINIMAL_TEST_CONFIG,
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_PKCE,
  TEST_USER_CONFIG,
} from '../../../test-utils/index.js';
import { runHttpPerf } from '../../../test-utils/perf/index.js';

const WARMUP_REQUESTS = 5;
const MEASURED_REQUESTS = 50;
const REFRESH_WARMUP_REQUESTS = 3;
const REFRESH_MEASURED_REQUESTS = 20;
const REFRESHABLE_CLIENT_ID = 'revoke-refresh-perf-id';
const REFRESHABLE_CLIENT_SECRET = 'revoke-refresh-perf-secret';
const REFRESHABLE_REDIRECT_URI =
  'http://localhost:8080/revoke-refresh/callback';
const REFRESHABLE_SCOPE = 'openid profile email offline_access';
const REFRESHABLE_CLIENT: NonNullable<
  TinyAuthRuntimeConfigInput['clients']
>[number] = {
  id: 'revoke-refresh-perf',
  name: 'Revoke Refresh Perf',
  client_id: REFRESHABLE_CLIENT_ID,
  client_secret: REFRESHABLE_CLIENT_SECRET,
  redirect_uris: [REFRESHABLE_REDIRECT_URI],
  response_types: ['code'],
  grant_types: ['authorization_code', 'refresh_token'],
  scope: REFRESHABLE_SCOPE,
};

let app: AppType;
let client: ReturnType<typeof testClient<AppType>>;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
    clients: [TEST_OAUTH_CLIENT_CONFIG, REFRESHABLE_CLIENT],
  });

  app = server.app;
  client = testClient(app);
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

async function createRevocationTokens(): Promise<string[]> {
  const tokens: string[] = [];
  const totalRequests = WARMUP_REQUESTS + MEASURED_REQUESTS;

  for (let index = 0; index < totalRequests; index += 1) {
    tokens.push(await getAccessToken(app, { scope: 'openid profile email' }));
  }

  return tokens;
}

async function requestTokenRevocation(tokens: string[]) {
  const token = tokens.shift();

  if (!token) {
    throw new Error('No pre-issued access token available for revocation');
  }

  const response = await client.oauth.revoke.$post({
    form: {
      token,
      token_type_hint: 'access_token',
      client_id: TEST_OAUTH_CLIENT.clientId,
      client_secret: TEST_OAUTH_CLIENT.clientSecret,
    },
  });

  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('application/json');
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('pragma')).toBe('no-cache');
  expect(await assertJsonBody(response)).toEqual({});

  return response;
}

async function createRefreshRevocationTokens(): Promise<string[]> {
  const tokens: string[] = [];
  const totalRequests = REFRESH_WARMUP_REQUESTS + REFRESH_MEASURED_REQUESTS;
  const sessionCookie = await createAuthenticatedSession(app);

  for (let index = 0; index < totalRequests; index += 1) {
    const { code } = await getAuthorizationCode(app, {
      sessionCookie,
      clientId: REFRESHABLE_CLIENT_ID,
      redirectUri: REFRESHABLE_REDIRECT_URI,
      scope: REFRESHABLE_SCOPE,
      state: `revoke-refresh-perf-state-${index}`,
      codeChallenge: TEST_PKCE.codeChallenge,
      codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
    });
    const response = await client.oauth.token.$post({
      form: {
        grant_type: 'authorization_code',
        code,
        client_id: REFRESHABLE_CLIENT_ID,
        client_secret: REFRESHABLE_CLIENT_SECRET,
        redirect_uri: REFRESHABLE_REDIRECT_URI,
        code_verifier: TEST_PKCE.codeVerifier,
      },
    });
    const body = await assertJsonBody(response);

    if (!body.refresh_token) {
      throw new Error('Missing refresh token for revocation perf');
    }
    tokens.push(body.refresh_token);
  }

  return tokens;
}

async function requestRefreshTokenRevocation(tokens: string[]) {
  const token = tokens.shift();

  if (!token) {
    throw new Error('No pre-issued refresh token available for revocation');
  }

  const response = await client.oauth.revoke.$post({
    form: {
      token,
      token_type_hint: 'refresh_token',
      client_id: REFRESHABLE_CLIENT_ID,
      client_secret: REFRESHABLE_CLIENT_SECRET,
    },
  });

  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('pragma')).toBe('no-cache');
  expect(await assertJsonBody(response)).toEqual({});

  return response;
}

async function requestInvalidTokenRevocation() {
  const response = await client.oauth.revoke.$post({
    form: {
      token: 'not-a-real-token',
      token_type_hint: 'access_token',
      client_id: TEST_OAUTH_CLIENT.clientId,
      client_secret: TEST_OAUTH_CLIENT.clientSecret,
    },
  });

  expect(await assertJsonBody(response)).toEqual({});

  return response;
}

describe('POST /oauth/revoke perf', () => {
  test('revokes pre-issued access tokens through the real route', async () => {
    const tokens = await createRevocationTokens();

    const result = await runHttpPerf({
      name: 'POST /oauth/revoke access-token smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [200],
      request: async () => requestTokenRevocation(tokens),
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(3);
    expect(result.p95Ms).toBeLessThan(1500);
  });

  test('revokes pre-issued refresh tokens through the real route', async () => {
    const tokens = await createRefreshRevocationTokens();

    const result = await runHttpPerf({
      name: 'POST /oauth/revoke refresh-token smoke',
      warmupRequests: REFRESH_WARMUP_REQUESTS,
      requests: REFRESH_MEASURED_REQUESTS,
      concurrency: 3,
      expectedStatuses: [200],
      request: async () => requestRefreshTokenRevocation(tokens),
    });

    expect(result.totalRequests).toBe(REFRESH_MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(REFRESH_MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(2);
    expect(result.p95Ms).toBeLessThan(2500);
  });

  test('handles invalid token revocation idempotently through the real route', async () => {
    const result = await runHttpPerf({
      name: 'POST /oauth/revoke invalid token smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [200],
      request: requestInvalidTokenRevocation,
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(5);
    expect(result.p95Ms).toBeLessThan(1000);
  });
});
