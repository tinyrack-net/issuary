import { testClient } from 'hono/testing';
import { exportJWK, generateKeyPair, type JWK, SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '../../../entrypoints/app.js';
import { apple } from '../../../entrypoints/identity-providers/apple.js';
import { google } from '../../../entrypoints/identity-providers/google.js';
import type { ServiceContainer } from '../../../services/container.js';
import {
  assertJsonBody,
  createAuthenticatedSession,
  createDbUserWithSession,
  createTestApp,
  extractCookie,
  generateUniqueEmail,
  getLocationHeader,
  MINIMAL_TEST_CONFIG,
  mockOAuthProviderFetch,
  TEST_USER_CONFIG,
  withMikroContext,
} from '../../../test-utils/index.js';
import { runHttpPerf } from '../../../test-utils/perf/index.js';

const WARMUP_REQUESTS = 1;
const MEASURED_REQUESTS = 10;
const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

let app: AppType;
let client: ReturnType<typeof testClient<AppType>>;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    registration: {
      enabled: true,
      allowed_email_patterns: ['*'],
    },
    users: [TEST_USER_CONFIG],
    identity_providers: [
      google({
        id: 'google',
        enabled: true,
        display_name: 'Google',
        client_id: 'test-google-client-id',
        client_secret: 'test-google-client-secret',
        email_conflict_strategy: 'auto_link',
      }),
      apple({
        id: 'apple',
        enabled: true,
        display_name: 'Apple',
        client_id: 'test-apple-client-id',
        client_secret: 'test-apple-client-secret',
        email_conflict_strategy: 'auto_link',
      }),
    ],
  });
  app = server.app;
  client = testClient(app);
  services = server.services;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

async function createOAuthLinkedFixture(index: number) {
  const { sessionCookie, userSub } = await createDbUserWithSession(
    app,
    services,
    generateUniqueEmail(`oauth-delete-perf-${index}`),
    'Password123!',
  );

  await withMikroContext(services, async () => {
    await services.mikro.userOAuth.linkAccount({
      userSub,
      providerName: 'google',
      providerUserId: `google-oauth-delete-${crypto.randomUUID()}`,
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresAt: null,
    });
  });

  return sessionCookie;
}

async function createOAuthLinkCallbackFixture(index: number) {
  const returnUrl = `/profile?tab=oauth-link-perf-${index}`;
  const { sessionCookie, userSub } = await createDbUserWithSession(
    app,
    services,
    generateUniqueEmail(`oauth-callback-link-perf-${index}`),
    'Password123!',
  );

  const authorizeResponse = await client.api.oauth[':provider'].authorize.$get(
    {
      param: { provider: 'google' },
      query: { mode: 'link', return_url: returnUrl },
    },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  expect(authorizeResponse.status).toBe(302);

  const location = new URL(getLocationHeader(authorizeResponse));
  const state = location.searchParams.get('state');
  if (!state) {
    throw new Error('Missing OAuth state from authorize response');
  }

  return {
    returnUrl,
    state,
    userSub,
    sessionCookie: extractCookie(authorizeResponse, 'session'),
  };
}

async function createOAuthLoginCallbackFixture(index: number) {
  const returnUrl = `/profile?tab=oauth-login-perf-${index}`;
  const email = generateUniqueEmail(`oauth-callback-login-perf-${index}`);
  const { userSub } = await createDbUserWithSession(
    app,
    services,
    email,
    'Password123!',
  );

  const authorizeResponse = await client.api.oauth[':provider'].authorize.$get({
    param: { provider: 'google' },
    query: { mode: 'login', return_url: returnUrl },
  });
  expect(authorizeResponse.status).toBe(302);

  const location = new URL(getLocationHeader(authorizeResponse));
  const state = location.searchParams.get('state');
  if (!state) {
    throw new Error('Missing OAuth state from authorize response');
  }

  return {
    email,
    returnUrl,
    state,
    userSub,
    sessionCookie: extractCookie(authorizeResponse, 'session'),
  };
}

async function createAppleFormPostFixture(index: number) {
  const authorizeResponse = await client.api.oauth[':provider'].authorize.$get({
    param: { provider: 'apple' },
    query: {
      mode: 'login',
      return_url: `/profile?tab=apple-form-post-perf-${index}`,
    },
  });
  expect(authorizeResponse.status).toBe(302);

  const location = new URL(getLocationHeader(authorizeResponse));
  const state = location.searchParams.get('state');
  if (!state) {
    throw new Error('Missing Apple OAuth state from authorize response');
  }

  return {
    oauthStateCookie: extractCookie(authorizeResponse, 'oauth_state'),
    state,
  };
}

async function createAppleIdToken(claims: {
  sub: string;
  email: string;
  emailVerified?: boolean;
}): Promise<{
  email: string;
  idToken: string;
  jwk: JWK & { kid: string; alg: string; use: string };
}> {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  const kid = `apple-perf-${crypto.randomUUID()}`;
  const idToken = await new SignJWT({
    sub: claims.sub,
    email: claims.email,
    email_verified: claims.emailVerified ?? true,
    iss: 'https://appleid.apple.com',
    aud: 'test-apple-client-id',
    exp: Math.floor(Date.now() / 1000) + 60,
  })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setIssuedAt()
    .sign(privateKey);

  return {
    email: claims.email,
    idToken,
    jwk: {
      ...jwk,
      kid,
      alg: 'RS256',
      use: 'sig',
    },
  };
}

async function requestOAuthAccounts(sessionCookie: string) {
  const response = await client.api.user['oauth-accounts'].$get(
    {},
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  const body = await assertJsonBody(response);

  expect(body.accounts).toEqual([]);
  expect(body.available_providers?.[0]?.id).toBe('google');
  expect(body.available_providers?.[0]?.linked).toBe(false);

  return response;
}

async function requestLinkedOAuthAccounts(sessionCookie: string) {
  const response = await client.api.user['oauth-accounts'].$get(
    {},
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  const body = await assertJsonBody(response);

  expect(
    body.accounts?.some((account) => account.provider_name === 'google'),
  ).toBe(true);
  expect(
    body.available_providers?.some(
      (provider) => provider.id === 'google' && provider.linked === true,
    ),
  ).toBe(true);

  return response;
}

async function verifyLinkedGoogleAccount(input: {
  sessionCookie: string;
  userSub: string;
}) {
  const accountsResponse = await client.api.user['oauth-accounts'].$get(
    {},
    { headers: { Cookie: `session=${input.sessionCookie}` } },
  );
  const body = await assertJsonBody(accountsResponse);
  expect(
    body.accounts?.some((account) => account.provider_name === 'google'),
  ).toBe(true);

  const sessionResponse = await client.api.user.session.$get(
    {},
    { headers: { Cookie: `session=${input.sessionCookie}` } },
  );
  const sessionBody = await assertJsonBody(sessionResponse);
  expect(sessionBody.user?.sub).toBe(input.userSub);
}

async function verifyAppleSession(input: {
  sessionCookie: string;
  email: string;
}) {
  const sessionResponse = await client.api.user.session.$get(
    {},
    { headers: { Cookie: `session=${input.sessionCookie}` } },
  );
  const sessionBody = await assertJsonBody(sessionResponse);
  expect(sessionBody.user?.email).toBe(input.email);
}

async function requestAuthorize() {
  const response = await client.api.oauth[':provider'].authorize.$get({
    param: { provider: 'google' },
    query: { mode: 'login' },
  });
  const location = new URL(getLocationHeader(response));

  expect(response.status).toBe(302);
  expect(location.origin).toBe('https://accounts.google.com');
  expect(location.searchParams.get('client_id')).toBe('test-google-client-id');
  expect(location.searchParams.get('response_type')).toBe('code');
  expect(location.searchParams.get('state')).toEqual(expect.any(String));
  expect(location.searchParams.get('code_challenge')).toEqual(
    expect.any(String),
  );
  expect(extractCookie(response, 'session')).toEqual(expect.any(String));

  return response;
}

async function requestCallbackGetMissingState() {
  const response = await client.api.oauth[':provider'].callback.$get({
    param: { provider: 'google' },
    query: { code: 'abc' },
  });
  const body = await assertJsonBody(response, 400);

  expect(body.code).toBe('OAUTH_INVALID_REQUEST');

  return response;
}

async function requestCallbackGetLinkSuccess(fixture: {
  returnUrl: string;
  sessionCookie: string;
  state: string;
  userSub: string;
}) {
  const response = await client.api.oauth[':provider'].callback.$get(
    {
      param: { provider: 'google' },
      query: { code: 'oauth-link-perf-code', state: fixture.state },
    },
    { headers: { Cookie: `session=${fixture.sessionCookie}` } },
  );

  expect(response.status).toBe(302);
  const location = new URL(getLocationHeader(response), 'http://test');
  expect(`${location.pathname}${location.search}`).toBe(fixture.returnUrl);

  const callbackCookie = extractCookie(response, 'session');

  return { response, callbackCookie };
}

async function requestCallbackGetLoginSuccess(fixture: {
  returnUrl: string;
  sessionCookie: string;
  state: string;
}) {
  const response = await client.api.oauth[':provider'].callback.$get(
    {
      param: { provider: 'google' },
      query: { code: 'oauth-login-perf-code', state: fixture.state },
    },
    { headers: { Cookie: `session=${fixture.sessionCookie}` } },
  );

  expect(response.status).toBe(302);
  const location = new URL(getLocationHeader(response), 'http://test');
  expect(`${location.pathname}${location.search}`).toBe(fixture.returnUrl);

  const callbackCookie = extractCookie(response, 'session');

  return { response, callbackCookie };
}

async function requestAppleFormPostSuccess(fixture: {
  oauthStateCookie: string;
  state: string;
}) {
  const response = await client.api.oauth[':provider'].callback.$post(
    {
      param: { provider: 'apple' },
      form: {
        code: 'apple-form-post-perf-code',
        state: fixture.state,
      },
    },
    { headers: { Cookie: `oauth_state=${fixture.oauthStateCookie}` } },
  );

  expect(response.status).toBe(302);
  expect(response.headers.get('set-cookie')).toContain('oauth_state=');

  return {
    response,
    callbackCookie: extractCookie(response, 'session'),
  };
}

async function requestCallbackPostMissingState() {
  const response = await client.api.oauth[':provider'].callback.$post({
    param: { provider: 'google' },
    form: { code: 'abc' },
  });
  const body = await assertJsonBody(response, 400);

  expect(body.code).toBe('OAUTH_INVALID_REQUEST');

  return response;
}

async function requestDelete(sessionCookie: string) {
  const response = await client.api.oauth[':provider'].$delete(
    { param: { provider: 'google' } },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  const body = await assertJsonBody(response);

  expect(body.ok).toBe(true);

  return response;
}

describe('GET /api/user/oauth-accounts perf', () => {
  test('handles repeated OAuth account list requests through the real route', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    const result = await runHttpPerf({
      name: 'GET /api/user/oauth-accounts smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      request: async () => requestOAuthAccounts(sessionCookie),
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(1);
    expect(result.p95Ms).toBeLessThan(2000);
  });

  test('handles linked OAuth account list requests through the real route', async () => {
    const sessionCookies = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, (_, index) =>
        createOAuthLinkedFixture(index),
      ),
    );
    let nextSession = 0;

    const result = await runHttpPerf({
      name: 'GET /api/user/oauth-accounts linked smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      request: async () => {
        const sessionCookie = sessionCookies[nextSession];
        nextSession += 1;
        if (!sessionCookie) {
          throw new Error('Missing OAuth account session');
        }
        return requestLinkedOAuthAccounts(sessionCookie);
      },
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(1);
    expect(result.p95Ms).toBeLessThan(2000);
  });
});

describe('GET /api/oauth/:provider/authorize perf', () => {
  test('handles repeated provider authorization redirects through the real route', async () => {
    const result = await runHttpPerf({
      name: 'GET /api/oauth/:provider/authorize smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      expectedStatuses: [302],
      request: requestAuthorize,
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[302]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(1);
    expect(result.p95Ms).toBeLessThan(2000);
  });
});

describe('GET /api/oauth/:provider/callback perf', () => {
  test('handles OAuth login callback success for existing users through the real route and service', async () => {
    const fixtures = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, (_, index) =>
        createOAuthLoginCallbackFixture(index),
      ),
    );
    let nextFixture = 0;
    const callbackSessions: Array<{ sessionCookie: string; userSub: string }> =
      [];

    const oauthMock = mockOAuthProviderFetch({
      tokenUrl: GOOGLE_TOKEN_URL,
      userInfoUrl: GOOGLE_USERINFO_URL,
      userInfoSequence: fixtures.map((fixture, index) => ({
        id: `google-login-perf-${crypto.randomUUID()}`,
        email: fixture.email,
        email_verified: true,
        name: `OAuth Login Perf User ${index}`,
      })),
    });

    try {
      const result = await runHttpPerf({
        name: 'GET /api/oauth/:provider/callback login existing-user success smoke',
        warmupRequests: WARMUP_REQUESTS,
        requests: MEASURED_REQUESTS,
        concurrency: 2,
        expectedStatuses: [302],
        request: async () => {
          const fixture = fixtures[nextFixture];
          nextFixture += 1;
          if (!fixture) {
            throw new Error('Missing OAuth login callback fixture');
          }
          const { response, callbackCookie } =
            await requestCallbackGetLoginSuccess(fixture);
          callbackSessions.push({
            sessionCookie: callbackCookie,
            userSub: fixture.userSub,
          });
          return response;
        },
      });

      expect(result.totalRequests).toBe(MEASURED_REQUESTS);
      expect(result.failed).toBe(0);
      expect(result.statusCounts[302]).toBe(MEASURED_REQUESTS);
      expect(result.errorRate).toBe(0);
      expect(result.rps).toBeGreaterThan(1);
      expect(result.p95Ms).toBeLessThan(2000);
      expect(oauthMock.countRequests(GOOGLE_TOKEN_URL)).toBe(
        WARMUP_REQUESTS + MEASURED_REQUESTS,
      );
      expect(oauthMock.countRequests(GOOGLE_USERINFO_URL)).toBe(
        WARMUP_REQUESTS + MEASURED_REQUESTS,
      );

      for (const callbackSession of callbackSessions.slice(0, 3)) {
        await verifyLinkedGoogleAccount(callbackSession);
      }
    } finally {
      oauthMock.restore();
    }
  });

  test('handles OAuth link callback success through the real route and service', async () => {
    const fixtures = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, (_, index) =>
        createOAuthLinkCallbackFixture(index),
      ),
    );
    let nextFixture = 0;
    const callbackSessions: Array<{ sessionCookie: string; userSub: string }> =
      [];

    const oauthMock = mockOAuthProviderFetch({
      tokenUrl: GOOGLE_TOKEN_URL,
      userInfoUrl: GOOGLE_USERINFO_URL,
      userInfoSequence: fixtures.map((_, index) => ({
        id: `google-link-perf-${crypto.randomUUID()}`,
        email: generateUniqueEmail(
          `oauth-callback-link-perf-provider-${index}`,
        ),
        email_verified: true,
        name: 'OAuth Link Perf User',
      })),
    });

    try {
      const result = await runHttpPerf({
        name: 'GET /api/oauth/:provider/callback link success smoke',
        warmupRequests: WARMUP_REQUESTS,
        requests: MEASURED_REQUESTS,
        concurrency: 2,
        expectedStatuses: [302],
        request: async () => {
          const fixture = fixtures[nextFixture];
          nextFixture += 1;
          if (!fixture) {
            throw new Error('Missing OAuth callback fixture');
          }
          const { response, callbackCookie } =
            await requestCallbackGetLinkSuccess(fixture);
          callbackSessions.push({
            sessionCookie: callbackCookie,
            userSub: fixture.userSub,
          });
          return response;
        },
      });

      expect(result.totalRequests).toBe(MEASURED_REQUESTS);
      expect(result.failed).toBe(0);
      expect(result.statusCounts[302]).toBe(MEASURED_REQUESTS);
      expect(result.errorRate).toBe(0);
      expect(result.rps).toBeGreaterThan(1);
      expect(result.p95Ms).toBeLessThan(2000);
      expect(oauthMock.countRequests(GOOGLE_TOKEN_URL)).toBe(
        WARMUP_REQUESTS + MEASURED_REQUESTS,
      );
      expect(oauthMock.countRequests(GOOGLE_USERINFO_URL)).toBe(
        WARMUP_REQUESTS + MEASURED_REQUESTS,
      );

      for (const callbackSession of callbackSessions.slice(0, 3)) {
        await verifyLinkedGoogleAccount(callbackSession);
      }
    } finally {
      oauthMock.restore();
    }
  });

  test('handles local invalid callback requests through the real route', async () => {
    const result = await runHttpPerf({
      name: 'GET /api/oauth/:provider/callback invalid request smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      expectedStatuses: [400],
      request: requestCallbackGetMissingState,
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[400]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(1);
    expect(result.p95Ms).toBeLessThan(2000);
  });
});

describe('POST /api/oauth/:provider/callback perf', () => {
  test('handles Apple form_post callback success through the real route and provider token service', async () => {
    const fixtures = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, (_, index) =>
        createAppleFormPostFixture(index),
      ),
    );
    const idTokenFixtures = await Promise.all(
      fixtures.map((_, index) =>
        createAppleIdToken({
          sub: `apple-form-post-perf-${crypto.randomUUID()}`,
          email: generateUniqueEmail(`apple-form-post-perf-${index}`),
        }),
      ),
    );
    let nextFixture = 0;
    const callbackSessions: Array<{ sessionCookie: string; email: string }> =
      [];

    const oauthMock = mockOAuthProviderFetch({
      tokenUrl: APPLE_TOKEN_URL,
      userInfoUrl: null,
      tokensSequence: idTokenFixtures.map((fixture) => ({
        id_token: fixture.idToken,
      })),
      jwksUrl: APPLE_JWKS_URL,
      jwks: {
        keys: idTokenFixtures.map((fixture) => fixture.jwk),
      },
    });

    try {
      const result = await runHttpPerf({
        name: 'POST /api/oauth/:provider/callback Apple form_post success smoke',
        warmupRequests: WARMUP_REQUESTS,
        requests: MEASURED_REQUESTS,
        concurrency: 2,
        expectedStatuses: [302],
        request: async () => {
          const fixture = fixtures[nextFixture];
          const idTokenFixture = idTokenFixtures[nextFixture];
          nextFixture += 1;
          if (!fixture || !idTokenFixture) {
            throw new Error('Missing Apple form_post callback fixture');
          }
          const { response, callbackCookie } =
            await requestAppleFormPostSuccess(fixture);
          callbackSessions.push({
            sessionCookie: callbackCookie,
            email: idTokenFixture.email,
          });
          return response;
        },
      });

      expect(result.totalRequests).toBe(MEASURED_REQUESTS);
      expect(result.failed).toBe(0);
      expect(result.statusCounts[302]).toBe(MEASURED_REQUESTS);
      expect(result.errorRate).toBe(0);
      expect(result.rps).toBeGreaterThan(1);
      expect(result.p95Ms).toBeLessThan(2500);
      expect(oauthMock.countRequests(APPLE_TOKEN_URL)).toBe(
        WARMUP_REQUESTS + MEASURED_REQUESTS,
      );

      for (const callbackSession of callbackSessions.slice(0, 3)) {
        await verifyAppleSession(callbackSession);
      }
    } finally {
      oauthMock.restore();
    }
  });

  test('handles local invalid form_post callback requests through the real route', async () => {
    const result = await runHttpPerf({
      name: 'POST /api/oauth/:provider/callback invalid request smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      expectedStatuses: [400],
      request: requestCallbackPostMissingState,
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[400]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(1);
    expect(result.p95Ms).toBeLessThan(2000);
  });
});

describe('DELETE /api/oauth/:provider perf', () => {
  test('handles pre-created OAuth unlink requests through the real route', async () => {
    const sessionCookies = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, (_, index) =>
        createOAuthLinkedFixture(index),
      ),
    );
    let nextSession = 0;

    const result = await runHttpPerf({
      name: 'DELETE /api/oauth/:provider smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      request: async () => {
        const sessionCookie = sessionCookies[nextSession];
        nextSession += 1;
        if (!sessionCookie) {
          throw new Error('Missing OAuth delete session');
        }
        return requestDelete(sessionCookie);
      },
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(1);
    expect(result.p95Ms).toBeLessThan(2000);
  });
});
