import { testClient } from 'hono/testing';
import { exportJWK, generateKeyPair, type JWK, SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

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
  type OAuthMockTokens,
  TEST_USER_CONFIG,
  withMikroContext,
} from '../../../test-utils/index.js';
import {
  deferPerfResponseValidation,
  perfFixture,
  runHttpPerf,
} from '../../../test-utils/perf/index.js';

const WARMUP_REQUESTS = 10;
const MEASURED_REQUESTS = 50;
const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

type OAuthCallbackSession = { sessionCookie: string; userSub: string };
type AppleCallbackSession = { sessionCookie: string; email: string };

let app: AppType;
let client: ReturnType<typeof testClient<AppType>>;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeEach(async () => {
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

afterEach(async () => {
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
    code: `oauth-link-perf-code-${index}`,
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
    accessToken: `oauth-login-perf-access-${index}`,
    code: `oauth-login-perf-code-${index}`,
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
    code: `apple-form-post-perf-code-${index}`,
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
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(body.accounts).toEqual([]);
    expect(body.available_providers?.[0]?.id).toBe('google');
    expect(body.available_providers?.[0]?.linked).toBe(false);
  });
}

async function requestLinkedOAuthAccounts(sessionCookie: string) {
  const response = await client.api.user['oauth-accounts'].$get(
    {},
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(
      body.accounts?.some((account) => account.provider_name === 'google'),
    ).toBe(true);
    expect(
      body.available_providers?.some(
        (provider) => provider.id === 'google' && provider.linked === true,
      ),
    ).toBe(true);
  });
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
  return deferPerfResponseValidation(response, async () => {
    const location = new URL(getLocationHeader(response));
    expect(response.status).toBe(302);
    expect(location.origin).toBe('https://accounts.google.com');
    expect(location.searchParams.get('client_id')).toBe(
      'test-google-client-id',
    );
    expect(location.searchParams.get('response_type')).toBe('code');
    expect(location.searchParams.get('state')).toEqual(expect.any(String));
    expect(location.searchParams.get('code_challenge')).toEqual(
      expect.any(String),
    );
    expect(extractCookie(response, 'session')).toEqual(expect.any(String));
  });
}

async function requestCallbackGetMissingState() {
  const response = await client.api.oauth[':provider'].callback.$get({
    param: { provider: 'google' },
    query: { code: 'abc' },
  });
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response, 400);
    expect(body.code).toBe('OAUTH_INVALID_REQUEST');
  });
}

async function requestCallbackGetLinkSuccess(
  fixture: {
    code: string;
    returnUrl: string;
    sessionCookie: string;
    state: string;
    userSub: string;
  },
  callbackSessions: OAuthCallbackSession[],
) {
  const response = await client.api.oauth[':provider'].callback.$get(
    {
      param: { provider: 'google' },
      query: { code: fixture.code, state: fixture.state },
    },
    { headers: { Cookie: `session=${fixture.sessionCookie}` } },
  );

  return deferPerfResponseValidation(response, async () => {
    expect(response.status).toBe(302);
    const location = new URL(getLocationHeader(response), 'http://test');
    expect(`${location.pathname}${location.search}`).toBe(fixture.returnUrl);
    callbackSessions.push({
      sessionCookie: extractCookie(response, 'session'),
      userSub: fixture.userSub,
    });
  });
}

async function requestCallbackGetLoginSuccess(
  fixture: {
    code: string;
    returnUrl: string;
    sessionCookie: string;
    state: string;
    userSub: string;
  },
  callbackSessions: OAuthCallbackSession[],
) {
  const response = await client.api.oauth[':provider'].callback.$get(
    {
      param: { provider: 'google' },
      query: { code: fixture.code, state: fixture.state },
    },
    { headers: { Cookie: `session=${fixture.sessionCookie}` } },
  );

  return deferPerfResponseValidation(response, async () => {
    expect(response.status).toBe(302);
    const location = new URL(getLocationHeader(response), 'http://test');
    expect(`${location.pathname}${location.search}`).toBe(fixture.returnUrl);
    callbackSessions.push({
      sessionCookie: extractCookie(response, 'session'),
      userSub: fixture.userSub,
    });
  });
}

async function requestAppleFormPostSuccess(
  fixture: {
    code: string;
    oauthStateCookie: string;
    state: string;
  },
  email: string,
  callbackSessions: AppleCallbackSession[],
) {
  const response = await client.api.oauth[':provider'].callback.$post(
    {
      param: { provider: 'apple' },
      form: {
        code: fixture.code,
        state: fixture.state,
      },
    },
    { headers: { Cookie: `oauth_state=${fixture.oauthStateCookie}` } },
  );

  return deferPerfResponseValidation(response, async () => {
    expect(response.status).toBe(302);
    expect(response.headers.get('set-cookie')).toContain('oauth_state=');
    callbackSessions.push({
      sessionCookie: extractCookie(response, 'session'),
      email,
    });
  });
}

async function requestCallbackPostMissingState() {
  const response = await client.api.oauth[':provider'].callback.$post({
    param: { provider: 'google' },
    form: { code: 'abc' },
  });
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response, 400);
    expect(body.code).toBe('OAUTH_INVALID_REQUEST');
  });
}

async function requestDelete(sessionCookie: string) {
  const response = await client.api.oauth[':provider'].$delete(
    { param: { provider: 'google' } },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(body.ok).toBe(true);
  });
}

describe('GET /api/user/oauth-accounts perf', () => {
  test('handles repeated OAuth account list requests through the real route', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    await runHttpPerf({
      name: 'GET /api/user/oauth-accounts smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      request: async () => requestOAuthAccounts(sessionCookie),
    });
  });

  test('handles linked OAuth account list requests through the real route', async () => {
    const sessionCookies = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, (_, index) =>
        createOAuthLinkedFixture(index),
      ),
    );
    await runHttpPerf({
      name: 'GET /api/user/oauth-accounts linked smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      request: async (context) => {
        const sessionCookie = perfFixture(
          sessionCookies,
          context,
          WARMUP_REQUESTS,
        );
        return requestLinkedOAuthAccounts(sessionCookie);
      },
    });
  });
});

describe('GET /api/oauth/:provider/authorize perf', () => {
  test('handles repeated provider authorization redirects through the real route', async () => {
    await runHttpPerf({
      name: 'GET /api/oauth/:provider/authorize smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      expectedStatuses: [302],
      request: requestAuthorize,
    });
  });
});

describe('GET /api/oauth/:provider/callback perf', () => {
  test('handles OAuth login callback success for existing users through the real route and service', async () => {
    const fixtures = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, (_, index) =>
        createOAuthLoginCallbackFixture(index),
      ),
    );
    const callbackSessions: OAuthCallbackSession[] = [];

    const oauthMock = mockOAuthProviderFetch({
      tokenUrl: GOOGLE_TOKEN_URL,
      userInfoUrl: GOOGLE_USERINFO_URL,
      tokensByCode: new Map(
        fixtures.map((fixture) => [
          fixture.code,
          { access_token: fixture.accessToken },
        ]),
      ),
      userInfoByAccessToken: new Map(
        fixtures.map((fixture, index) => [
          fixture.accessToken,
          {
            id: `google-login-perf-${crypto.randomUUID()}`,
            email: fixture.email,
            email_verified: true,
            name: `OAuth Login Perf User ${index}`,
          },
        ]),
      ),
    });

    try {
      await runHttpPerf({
        name: 'GET /api/oauth/:provider/callback login existing-user success smoke',
        warmupRequests: WARMUP_REQUESTS,
        requests: MEASURED_REQUESTS,
        concurrency: 2,
        expectedStatuses: [302],
        request: async (context) => {
          const fixture = perfFixture(fixtures, context, WARMUP_REQUESTS);
          return requestCallbackGetLoginSuccess(fixture, callbackSessions);
        },
      });

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
    const providerFixtures = fixtures.map((fixture, index) => ({
      accessToken: `oauth-link-perf-access-${index}`,
      code: fixture.code,
      userInfo: {
        id: `google-link-perf-${crypto.randomUUID()}`,
        email: generateUniqueEmail(
          `oauth-callback-link-perf-provider-${index}`,
        ),
        email_verified: true,
        name: 'OAuth Link Perf User',
      },
    }));
    const callbackSessions: OAuthCallbackSession[] = [];

    const oauthMock = mockOAuthProviderFetch({
      tokenUrl: GOOGLE_TOKEN_URL,
      userInfoUrl: GOOGLE_USERINFO_URL,
      tokensByCode: new Map(
        providerFixtures.map((fixture) => [
          fixture.code,
          { access_token: fixture.accessToken },
        ]),
      ),
      userInfoByAccessToken: new Map(
        providerFixtures.map((fixture) => [
          fixture.accessToken,
          fixture.userInfo,
        ]),
      ),
    });

    try {
      await runHttpPerf({
        name: 'GET /api/oauth/:provider/callback link success smoke',
        warmupRequests: WARMUP_REQUESTS,
        requests: MEASURED_REQUESTS,
        concurrency: 2,
        expectedStatuses: [302],
        request: async (context) => {
          const fixture = perfFixture(fixtures, context, WARMUP_REQUESTS);
          return requestCallbackGetLinkSuccess(fixture, callbackSessions);
        },
      });

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
    await runHttpPerf({
      name: 'GET /api/oauth/:provider/callback invalid request smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      expectedStatuses: [400],
      request: requestCallbackGetMissingState,
    });
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
    const callbackSessions: AppleCallbackSession[] = [];
    const tokensByCode = new Map<string, Partial<OAuthMockTokens>>();
    for (const [index, idTokenFixture] of idTokenFixtures.entries()) {
      const fixture = fixtures[index];
      if (!fixture) {
        throw new Error(`Missing Apple callback fixture at index ${index}`);
      }
      tokensByCode.set(fixture.code, { id_token: idTokenFixture.idToken });
    }

    const oauthMock = mockOAuthProviderFetch({
      tokenUrl: APPLE_TOKEN_URL,
      userInfoUrl: null,
      tokensByCode,
      jwksUrl: APPLE_JWKS_URL,
      jwks: {
        keys: idTokenFixtures.map((fixture) => fixture.jwk),
      },
    });

    try {
      await runHttpPerf({
        name: 'POST /api/oauth/:provider/callback Apple form_post success smoke',
        warmupRequests: WARMUP_REQUESTS,
        requests: MEASURED_REQUESTS,
        concurrency: 2,
        expectedStatuses: [302],
        request: async (context) => {
          const fixture = perfFixture(fixtures, context, WARMUP_REQUESTS);
          const idTokenFixture = perfFixture(
            idTokenFixtures,
            context,
            WARMUP_REQUESTS,
          );
          return requestAppleFormPostSuccess(
            fixture,
            idTokenFixture.email,
            callbackSessions,
          );
        },
      });

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
    await runHttpPerf({
      name: 'POST /api/oauth/:provider/callback invalid request smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      expectedStatuses: [400],
      request: requestCallbackPostMissingState,
    });
  });
});

describe('DELETE /api/oauth/:provider perf', () => {
  test('handles pre-created OAuth unlink requests through the real route', async () => {
    const sessionCookies = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, (_, index) =>
        createOAuthLinkedFixture(index),
      ),
    );
    await runHttpPerf({
      name: 'DELETE /api/oauth/:provider smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      request: async (context) => {
        const sessionCookie = perfFixture(
          sessionCookies,
          context,
          WARMUP_REQUESTS,
        );
        return requestDelete(sessionCookie);
      },
    });
  });
});
