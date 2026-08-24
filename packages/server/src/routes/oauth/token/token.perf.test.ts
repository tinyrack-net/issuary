import { testClient } from 'hono/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import type { AppType } from '../../../entrypoints/app.js';
import type { IssuaryRuntimeConfigInput } from '../../../lib/config/index.js';
import {
  assertJsonBody,
  createAuthenticatedSession,
  createTestApp,
  getAuthorizationCode,
  MINIMAL_TEST_CONFIG,
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_PKCE,
  TEST_USER_CONFIG,
} from '../../../test-utils/index.js';
import {
  deferPerfResponseValidation,
  perfFixture,
  runHttpPerf,
} from '../../../test-utils/perf/index.js';

const WARMUP_REQUESTS = 10;
const MEASURED_REQUESTS = 50;
const REFRESH_WARMUP_REQUESTS = 4;
const REFRESH_MEASURED_REQUESTS = 20;
const REFRESHABLE_CLIENT_ID = 'token-refresh-perf-id';
const REFRESHABLE_CLIENT_SECRET = 'token-refresh-perf-secret';
const REFRESHABLE_REDIRECT_URI = 'http://localhost:8080/token-refresh/callback';
const REFRESHABLE_SCOPE = 'openid profile email offline_access';
const CLIENT_CREDENTIALS_CLIENT: NonNullable<
  IssuaryRuntimeConfigInput['clients']
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
const REFRESHABLE_CLIENT: NonNullable<
  IssuaryRuntimeConfigInput['clients']
>[number] = {
  id: 'token-refresh-perf',
  name: 'Token Refresh Perf',
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

beforeEach(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
    clients: [
      TEST_OAUTH_CLIENT_CONFIG,
      CLIENT_CREDENTIALS_CLIENT,
      REFRESHABLE_CLIENT,
    ],
  });

  app = server.app;
  client = testClient(app);
  cleanup = server.cleanup;
});

afterEach(async () => {
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

async function requestTokenExchange(code: string): Promise<Response> {
  const response = await client.oauth.token.$post({
    form: {
      grant_type: 'authorization_code',
      code,
      client_id: TEST_OAUTH_CLIENT.clientId,
      client_secret: TEST_OAUTH_CLIENT.clientSecret,
      redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
      code_verifier: TEST_PKCE.codeVerifier,
    },
  });
  return deferPerfResponseValidation(response, async () => {
    const json = await assertJsonBody(response);
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
  });
}

async function requestClientCredentialsToken(): Promise<Response> {
  const credentials = Buffer.from(
    `${CLIENT_CREDENTIALS_CLIENT.client_id}:${CLIENT_CREDENTIALS_CLIENT.client_secret}`,
  ).toString('base64');
  const response = await client.oauth.token.$post(
    {
      form: {
        grant_type: 'client_credentials',
        scope: 'api:read',
      },
    },
    { headers: { authorization: `Basic ${credentials}` } },
  );
  return deferPerfResponseValidation(response, async () => {
    const json = await assertJsonBody(response);
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
  });
}

async function createRefreshTokens(sessionCookie: string): Promise<string[]> {
  const refreshTokens: string[] = [];
  const totalRequests = REFRESH_WARMUP_REQUESTS + REFRESH_MEASURED_REQUESTS;

  for (let index = 0; index < totalRequests; index += 1) {
    const { code } = await getAuthorizationCode(app, {
      sessionCookie,
      clientId: REFRESHABLE_CLIENT_ID,
      redirectUri: REFRESHABLE_REDIRECT_URI,
      scope: REFRESHABLE_SCOPE,
      state: `token-refresh-perf-state-${index}`,
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
    const json = await assertJsonBody(response);

    if (!json.refresh_token) {
      throw new Error('Missing pre-issued refresh token');
    }
    refreshTokens.push(json.refresh_token);
  }

  return refreshTokens;
}

async function requestRefreshTokenExchange(
  refreshToken: string,
): Promise<Response> {
  const response = await client.oauth.token.$post({
    form: {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: REFRESHABLE_CLIENT_ID,
      client_secret: REFRESHABLE_CLIENT_SECRET,
    },
  });
  return deferPerfResponseValidation(response, async () => {
    const json = await assertJsonBody(response);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
    expect(json).toEqual(
      expect.objectContaining({
        access_token: expect.any(String),
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: expect.any(String),
        id_token: expect.any(String),
        scope: REFRESHABLE_SCOPE,
      }),
    );
  });
}

describe('POST /oauth/token perf', () => {
  test('exchanges pre-generated authorization codes through the real route', async () => {
    const sessionCookie = await createAuthenticatedSession(app);
    const codes = await createTokenRequestCodes(sessionCookie);

    await runHttpPerf({
      name: 'POST /oauth/token authorization-code PKCE exchange smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [200],
      request: async (context) =>
        requestTokenExchange(perfFixture(codes, context, WARMUP_REQUESTS)),
    });
  });

  test('issues client credentials tokens through the real route', async () => {
    await runHttpPerf({
      name: 'POST /oauth/token client_credentials smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [200],
      request: requestClientCredentialsToken,
    });
  });

  test('refreshes pre-issued refresh tokens through the real route', async () => {
    const sessionCookie = await createAuthenticatedSession(app);
    const refreshTokens = await createRefreshTokens(sessionCookie);

    await runHttpPerf({
      name: 'POST /oauth/token refresh_token rotation smoke',
      warmupRequests: REFRESH_WARMUP_REQUESTS,
      requests: REFRESH_MEASURED_REQUESTS,
      concurrency: 3,
      expectedStatuses: [200],
      request: async (context) =>
        requestRefreshTokenExchange(
          perfFixture(refreshTokens, context, REFRESH_WARMUP_REQUESTS),
        ),
    });
  });
});
