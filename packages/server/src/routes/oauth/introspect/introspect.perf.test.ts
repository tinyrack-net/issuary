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
const REFRESHABLE_CLIENT_ID = 'introspect-refresh-perf-id';
const REFRESHABLE_CLIENT_SECRET = 'introspect-refresh-perf-secret';
const REFRESHABLE_REDIRECT_URI =
  'http://localhost:8080/introspect-refresh/callback';
const REFRESHABLE_SCOPE = 'openid profile email offline_access';
const REFRESHABLE_CLIENT: NonNullable<
  TinyAuthRuntimeConfigInput['clients']
>[number] = {
  id: 'introspect-refresh-perf',
  name: 'Introspect Refresh Perf',
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

async function requestTokenIntrospection(accessToken: string) {
  const response = await client.oauth.introspect.$post({
    form: {
      token: accessToken,
      token_type_hint: 'access_token',
      client_id: TEST_OAUTH_CLIENT.clientId,
      client_secret: TEST_OAUTH_CLIENT.clientSecret,
    },
  });
  const body = await assertJsonBody(response);

  expect(response.headers.get('content-type')).toContain('application/json');
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('pragma')).toBe('no-cache');
  expect(body).toEqual(
    expect.objectContaining({
      active: true,
      client_id: TEST_OAUTH_CLIENT.clientId,
      sub: TEST_USER_CONFIG.sub,
      token_type: 'Bearer',
      scope: 'openid profile email',
    }),
  );

  return response;
}

async function createRefreshToken(): Promise<string> {
  const sessionCookie = await createAuthenticatedSession(app);
  const { code } = await getAuthorizationCode(app, {
    sessionCookie,
    clientId: REFRESHABLE_CLIENT_ID,
    redirectUri: REFRESHABLE_REDIRECT_URI,
    scope: REFRESHABLE_SCOPE,
    state: 'introspect-refresh-perf-state',
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
    throw new Error('Missing refresh token for introspection perf');
  }

  return body.refresh_token;
}

async function requestRefreshTokenIntrospection(refreshToken: string) {
  const response = await client.oauth.introspect.$post({
    form: {
      token: refreshToken,
      token_type_hint: 'refresh_token',
      client_id: REFRESHABLE_CLIENT_ID,
      client_secret: REFRESHABLE_CLIENT_SECRET,
    },
  });
  const body = await assertJsonBody(response);

  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('pragma')).toBe('no-cache');
  expect(body).toEqual(
    expect.objectContaining({
      active: true,
      client_id: REFRESHABLE_CLIENT_ID,
      sub: TEST_USER_CONFIG.sub,
      token_type: 'Bearer',
      scope: REFRESHABLE_SCOPE,
    }),
  );

  return response;
}

async function requestInactiveTokenIntrospection() {
  const response = await client.oauth.introspect.$post({
    form: {
      token: 'not-a-real-token',
      token_type_hint: 'access_token',
      client_id: TEST_OAUTH_CLIENT.clientId,
      client_secret: TEST_OAUTH_CLIENT.clientSecret,
    },
  });

  expect(await assertJsonBody(response)).toEqual({ active: false });

  return response;
}

describe('POST /oauth/introspect perf', () => {
  test('introspects a pre-issued active access token through the real route', async () => {
    const accessToken = await getAccessToken(app, {
      scope: 'openid profile email',
    });

    const result = await runHttpPerf({
      name: 'POST /oauth/introspect active access-token smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [200],
      request: async () => requestTokenIntrospection(accessToken),
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(5);
    expect(result.p95Ms).toBeLessThan(1000);
  });

  test('introspects a pre-issued active refresh token through the real route', async () => {
    const refreshToken = await createRefreshToken();

    const result = await runHttpPerf({
      name: 'POST /oauth/introspect active refresh-token smoke',
      warmupRequests: REFRESH_WARMUP_REQUESTS,
      requests: REFRESH_MEASURED_REQUESTS,
      concurrency: 3,
      expectedStatuses: [200],
      request: async () => requestRefreshTokenIntrospection(refreshToken),
    });

    expect(result.totalRequests).toBe(REFRESH_MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(REFRESH_MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(3);
    expect(result.p95Ms).toBeLessThan(1000);
  });

  test('handles inactive token introspection through the real route', async () => {
    const result = await runHttpPerf({
      name: 'POST /oauth/introspect inactive token smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [200],
      request: requestInactiveTokenIntrospection,
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(5);
    expect(result.p95Ms).toBeLessThan(1000);
  });
});
