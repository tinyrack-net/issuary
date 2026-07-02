import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '../../../entrypoints/app.js';
import type { TinyAuthRuntimeConfigInput } from '../../../lib/config/index.js';
import {
  createAuthenticatedSession,
  createTestApp,
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
const CLIENT_CREDENTIALS_CLIENT: NonNullable<
  TinyAuthRuntimeConfigInput['clients']
>[number] = {
  id: 'token-client-credentials-perf',
  name: 'Token Client Credentials Perf',
  client_id: 'token-client-credentials-perf-id',
  client_secret: 'token-client-credentials-perf-secret',
  redirect_uris: ['http://localhost:8080/client-credentials/callback'],
  response_types: ['code'],
  grant_types: ['authorization_code', 'client_credentials'],
  scope: 'api:read api:write',
};

let app: AppType;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
    clients: [TEST_OAUTH_CLIENT_CONFIG, CLIENT_CREDENTIALS_CLIENT],
  });

  app = server.app;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

async function createTokenRequestCodes(
  sessionCookie: string,
): Promise<string[]> {
  const codes: string[] = [];
  const totalRequests = WARMUP_REQUESTS + MEASURED_REQUESTS;

  for (let index = 0; index < totalRequests; index += 1) {
    const { code } = await getAuthorizationCode(app, {
      sessionCookie,
      state: `token-perf-state-${index}`,
      codeChallenge: TEST_PKCE.codeChallenge,
      codeChallengeMethod: TEST_PKCE.codeChallengeMethod,
    });
    codes.push(code);
  }

  return codes;
}

async function requestTokenExchange(codes: string[]): Promise<Response> {
  const code = codes.shift();

  if (!code) {
    throw new Error('No pre-generated authorization code available');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: TEST_OAUTH_CLIENT.clientId,
    client_secret: TEST_OAUTH_CLIENT.clientSecret,
    redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
    code_verifier: TEST_PKCE.codeVerifier,
  });

  const response = await app.request('/oauth/token', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const json = await response.json();

  expect(response.status).toBe(200);
  expect(json).toEqual(
    expect.objectContaining({
      access_token: expect.any(String),
      token_type: 'Bearer',
      expires_in: 3600,
      id_token: expect.any(String),
      scope: 'openid profile email',
    }),
  );
  expect(json.refresh_token).toBeUndefined();

  return response;
}

async function requestClientCredentialsToken(): Promise<Response> {
  const credentials = Buffer.from(
    `${CLIENT_CREDENTIALS_CLIENT.client_id}:${CLIENT_CREDENTIALS_CLIENT.client_secret}`,
  ).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'api:read',
  });

  const response = await app.request('/oauth/token', {
    method: 'POST',
    headers: {
      authorization: `Basic ${credentials}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const json = await response.clone().json();

  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('pragma')).toBe('no-cache');
  expect(json).toEqual(
    expect.objectContaining({
      access_token: expect.any(String),
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'api:read',
    }),
  );
  expect(json.id_token).toBeUndefined();
  expect(json.refresh_token).toBeUndefined();

  return response;
}

describe('POST /oauth/token perf', () => {
  test('exchanges pre-generated authorization codes through the real route', async () => {
    const sessionCookie = await createAuthenticatedSession(app);
    const codes = await createTokenRequestCodes(sessionCookie);

    const result = await runHttpPerf({
      name: 'POST /oauth/token authorization-code PKCE exchange smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [200],
      request: async () => requestTokenExchange(codes),
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(3);
    expect(result.p95Ms).toBeLessThan(1500);
  });

  test('issues client credentials tokens through the real route', async () => {
    const result = await runHttpPerf({
      name: 'POST /oauth/token client_credentials smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [200],
      request: requestClientCredentialsToken,
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(3);
    expect(result.p95Ms).toBeLessThan(1500);
  });
});
