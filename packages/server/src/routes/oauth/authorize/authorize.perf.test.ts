import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '../../../entrypoints/app.js';
import {
  createAuthenticatedSession,
  createTestApp,
  getLocationHeader,
  grantConsent,
  MINIMAL_TEST_CONFIG,
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_PKCE,
  TEST_USER_CONFIG,
} from '../../../test-utils/index.js';
import { runHttpPerf } from '../../../test-utils/perf/index.js';

let app: AppType;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
    clients: [TEST_OAUTH_CLIENT_CONFIG],
  });

  app = server.app;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

function createAuthorizeUrl(): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: TEST_OAUTH_CLIENT.clientId,
    redirect_uri: TEST_OAUTH_CLIENT.redirectUri,
    scope: 'openid profile email',
    state: 'authorize-perf-state',
    code_challenge: TEST_PKCE.codeChallenge,
    code_challenge_method: TEST_PKCE.codeChallengeMethod,
  });

  return `/oauth/authorize?${params.toString()}`;
}

async function requestAuthorizeRedirect(sessionCookie: string) {
  const response = await app.request(createAuthorizeUrl(), {
    headers: { Cookie: `session=${sessionCookie}` },
  });
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
      warmupRequests: 5,
      requests: 50,
      concurrency: 5,
      expectedStatuses: [302],
      request: async () => requestAuthorizeRedirect(sessionCookie),
    });

    expect(result.totalRequests).toBe(50);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[302]).toBe(50);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(3);
    expect(result.p95Ms).toBeLessThan(1500);
  });
});
