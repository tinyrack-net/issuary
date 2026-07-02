import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '../../../entrypoints/app.js';
import {
  createTestApp,
  getAccessToken,
  MINIMAL_TEST_CONFIG,
  TEST_OAUTH_CLIENT,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_USER_CONFIG,
} from '../../../test-utils/index.js';
import { runHttpPerf } from '../../../test-utils/perf/index.js';

const WARMUP_REQUESTS = 5;
const MEASURED_REQUESTS = 50;

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

async function requestTokenIntrospection(accessToken: string) {
  const response = await app.request('/oauth/introspect', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      token: accessToken,
      token_type_hint: 'access_token',
      client_id: TEST_OAUTH_CLIENT.clientId,
      client_secret: TEST_OAUTH_CLIENT.clientSecret,
    }),
  });
  const body = await response.clone().json();

  expect(response.status).toBe(200);
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
});
