import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '../../../entrypoints/app.js';
import type { ServiceContainer } from '../../../services/container.js';
import {
  createAuthenticatedSession,
  createDbUserWithSession,
  createTestApp,
  generateUniqueEmail,
  getLocationHeader,
  grantConsent,
  MINIMAL_TEST_CONFIG,
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_PKCE,
  TEST_USER_CONFIG,
} from '../../../test-utils/index.js';
import { runHttpPerf } from '../../../test-utils/perf/index.js';

const WARMUP_REQUESTS = 5;
const MEASURED_REQUESTS = 50;

let app: AppType;
let client: ReturnType<typeof testClient<AppType>>;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
    clients: [TEST_OAUTH_CLIENT_CONFIG],
  });

  app = server.app;
  client = testClient(app);
  services = server.services;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

function createAuthorizeQuery() {
  return {
    response_type: 'code',
    client_id: TEST_OAUTH_CLIENT.clientId,
    redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
    scope: 'openid profile email',
    state: 'authorize-perf-state',
    code_challenge: TEST_PKCE.codeChallenge,
    code_challenge_method: TEST_PKCE.codeChallengeMethod,
  };
}

async function requestAuthorizeRedirect(sessionCookie: string) {
  const response = await client.oauth.authorize.$get(
    { query: createAuthorizeQuery() },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  const location = new URL(getLocationHeader(response));

  expect(response.status).toBe(302);
  expect(location.origin).toBe(new URL(TEST_OAUTH_CLIENT.redirectUri).origin);
  expect(location.pathname).toBe(
    new URL(TEST_OAUTH_CLIENT.redirectUri).pathname,
  );
  expect(location.searchParams.get('code')).toEqual(expect.any(String));
  expect(location.searchParams.get('state')).toBe('authorize-perf-state');

  return response;
}

async function requestAuthorizeLoginRedirect() {
  const response = await client.oauth.authorize.$get({
    query: createAuthorizeQuery(),
  });
  const location = new URL(getLocationHeader(response));

  expect(response.status).toBe(302);
  expect(location.pathname).toBe('/login');
  expect(location.searchParams.get('client_id')).toBe(
    TEST_OAUTH_CLIENT.clientId,
  );
  expect(location.searchParams.get('redirect_uri')).toBe(
    TEST_OAUTH_CLIENT.redirectUri,
  );

  return response;
}

async function requestAuthorizeConsentRedirect(sessionCookie: string) {
  const response = await client.oauth.authorize.$get(
    { query: createAuthorizeQuery() },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  const location = new URL(getLocationHeader(response));

  expect(response.status).toBe(302);
  expect(location.pathname).toBe('/consent');
  expect(location.searchParams.get('client_id')).toBe(
    TEST_OAUTH_CLIENT.clientId,
  );
  expect(location.searchParams.get('redirect_uri')).toBe(
    TEST_OAUTH_CLIENT.redirectUri,
  );

  return response;
}

describe('GET /oauth/authorize perf', () => {
  test('handles repeated authorization-code redirects through the real route', async () => {
    const sessionCookie = await createAuthenticatedSession(app);
    await grantConsent(app, sessionCookie, {
      client_id: TEST_OAUTH_CLIENT.clientId,
      redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
      response_type: 'code',
      scope: 'openid profile email',
      state: 'authorize-perf-state',
      code_challenge: TEST_PKCE.codeChallenge,
      code_challenge_method: TEST_PKCE.codeChallengeMethod,
    });

    const result = await runHttpPerf({
      name: 'GET /oauth/authorize authorization-code redirect smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [302],
      request: async () => requestAuthorizeRedirect(sessionCookie),
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[302]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(3);
    expect(result.p95Ms).toBeLessThan(1500);
  });

  test('handles unauthenticated login redirects through the real route', async () => {
    const result = await runHttpPerf({
      name: 'GET /oauth/authorize login redirect smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [302],
      request: requestAuthorizeLoginRedirect,
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[302]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(5);
    expect(result.p95Ms).toBeLessThan(1000);
  });

  test('handles authenticated consent redirects through the real route', async () => {
    const email = generateUniqueEmail('authorize-consent-perf');
    const password = 'Password123!';
    const { sessionCookie } = await createDbUserWithSession(
      app,
      services,
      email,
      password,
    );

    const result = await runHttpPerf({
      name: 'GET /oauth/authorize consent redirect smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [302],
      request: async () => requestAuthorizeConsentRedirect(sessionCookie),
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[302]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(3);
    expect(result.p95Ms).toBeLessThan(1500);
  });
});
