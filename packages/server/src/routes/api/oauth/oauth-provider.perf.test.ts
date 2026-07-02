import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '../../../entrypoints/app.js';
import { google } from '../../../entrypoints/identity-providers/google.js';
import type { ServiceContainer } from '../../../services/container.js';
import {
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
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
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
    ],
  });
  app = server.app;
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

  const authorizeResponse = await app.request(
    `/api/oauth/google/authorize?mode=link&return_url=${encodeURIComponent(returnUrl)}`,
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

async function requestOAuthAccounts(sessionCookie: string) {
  const response = await app.request('/api/user/oauth-accounts', {
    headers: { Cookie: `session=${sessionCookie}` },
  });
  const body: {
    accounts?: unknown[];
    available_providers?: Array<{ id?: string; linked?: boolean }>;
  } = await response.clone().json();

  expect(response.status).toBe(200);
  expect(body.accounts).toEqual([]);
  expect(body.available_providers?.[0]?.id).toBe('google');
  expect(body.available_providers?.[0]?.linked).toBe(false);

  return response;
}

async function requestAuthorize() {
  const response = await app.request('/api/oauth/google/authorize?mode=login');
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
  const response = await app.request('/api/oauth/google/callback?code=abc');
  const body: { code?: string } = await response.clone().json();

  expect(response.status).toBe(400);
  expect(body.code).toBe('OAUTH_INVALID_REQUEST');

  return response;
}

async function requestCallbackGetLinkSuccess(fixture: {
  returnUrl: string;
  sessionCookie: string;
  state: string;
  userSub: string;
}) {
  const response = await app.request(
    `/api/oauth/google/callback?code=oauth-link-perf-code&state=${encodeURIComponent(fixture.state)}`,
    { headers: { Cookie: `session=${fixture.sessionCookie}` } },
  );

  expect(response.status).toBe(302);
  const location = new URL(getLocationHeader(response), 'http://test');
  expect(`${location.pathname}${location.search}`).toBe(fixture.returnUrl);

  const callbackCookie = extractCookie(response, 'session');
  const accountsResponse = await app.request('/api/user/oauth-accounts', {
    headers: { Cookie: `session=${callbackCookie}` },
  });
  const body: { accounts?: Array<{ provider_name?: string }> } =
    await accountsResponse.clone().json();
  expect(accountsResponse.status).toBe(200);
  expect(
    body.accounts?.some((account) => account.provider_name === 'google'),
  ).toBe(true);

  const sessionResponse = await app.request('/api/user/session', {
    headers: { Cookie: `session=${callbackCookie}` },
  });
  const sessionBody: { user?: { sub?: string } | null } = await sessionResponse
    .clone()
    .json();
  expect(sessionResponse.status).toBe(200);
  expect(sessionBody.user?.sub).toBe(fixture.userSub);

  return response;
}

async function requestCallbackPostMissingState() {
  const form = new URLSearchParams({ code: 'abc' });
  const response = await app.request('/api/oauth/google/callback', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const body: { code?: string } = await response.clone().json();

  expect(response.status).toBe(400);
  expect(body.code).toBe('OAUTH_INVALID_REQUEST');

  return response;
}

async function requestDelete(sessionCookie: string) {
  const response = await app.request('/api/oauth/google', {
    method: 'DELETE',
    headers: { Cookie: `session=${sessionCookie}` },
  });
  const body: { ok?: boolean } = await response.clone().json();

  expect(response.status).toBe(200);
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
  test('handles OAuth link callback success through the real route and service', async () => {
    const fixtures = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, (_, index) =>
        createOAuthLinkCallbackFixture(index),
      ),
    );
    let nextFixture = 0;

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
          return requestCallbackGetLinkSuccess(fixture);
        },
      });

      expect(result.totalRequests).toBe(MEASURED_REQUESTS);
      expect(result.failed).toBe(0);
      expect(result.statusCounts[302]).toBe(MEASURED_REQUESTS);
      expect(result.errorRate).toBe(0);
      expect(result.rps).toBeGreaterThan(1);
      expect(result.p95Ms).toBeLessThan(2000);
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
