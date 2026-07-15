import { testClient } from 'hono/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import type { AppType } from '../../../entrypoints/app.js';
import type { TinyAuthRuntimeConfigInput } from '../../../lib/config/index.js';
import {
  createTestApp,
  MINIMAL_TEST_CONFIG,
} from '../../../test-utils/index.js';
import {
  deferPerfResponseValidation,
  runHttpPerf,
} from '../../../test-utils/perf/index.js';

const WARMUP_REQUESTS = 10;
const MEASURED_REQUESTS = 50;
const END_SESSION_CLIENT_ID = 'end-session-perf-client';
const POST_LOGOUT_REDIRECT_URI = 'http://localhost:8080/logout/complete';
const END_SESSION_CLIENT: NonNullable<
  TinyAuthRuntimeConfigInput['clients']
>[number] = {
  id: 'end-session-perf',
  name: 'End Session Perf',
  client_id: END_SESSION_CLIENT_ID,
  client_secret: 'end-session-perf-secret',
  redirect_uris: ['http://localhost:8080/end-session/callback'],
  post_logout_redirect_uris: [POST_LOGOUT_REDIRECT_URI],
  response_types: ['code'],
  grant_types: ['authorization_code'],
  scope: 'openid profile email',
};

let client: ReturnType<typeof testClient<AppType>>;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    clients: [END_SESSION_CLIENT],
  });

  client = testClient(server.app);
  cleanup = server.cleanup;
});

afterEach(async () => {
  await cleanup();
});

async function requestDefaultEndSessionRedirect() {
  const response = await client.oauth.end_session.$get({ query: {} });

  return deferPerfResponseValidation(response, async () => {
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('http://localhost:8080');
    expect(response.headers.get('set-cookie')).toContain('session=');
  });
}

async function requestRegisteredPostLogoutRedirect() {
  const response = await client.oauth.end_session.$get({
    query: {
      client_id: END_SESSION_CLIENT_ID,
      post_logout_redirect_uri: POST_LOGOUT_REDIRECT_URI,
      state: 'end-session-perf-state',
    },
  });

  return deferPerfResponseValidation(response, async () => {
    expect(response.status).toBe(302);
    const locationHeader = response.headers.get('location');
    expect(locationHeader).toEqual(expect.any(String));
    if (!locationHeader) {
      throw new Error('Missing end-session post-logout redirect location');
    }
    const location = new URL(locationHeader);
    expect(location.origin).toBe(new URL(POST_LOGOUT_REDIRECT_URI).origin);
    expect(location.pathname).toBe(new URL(POST_LOGOUT_REDIRECT_URI).pathname);
    expect(location.searchParams.get('state')).toBe('end-session-perf-state');
    expect(response.headers.get('set-cookie')).toContain('session=');
  });
}

describe('GET /oauth/end_session perf', () => {
  test('clears the session cookie and redirects through the real route', async () => {
    await runHttpPerf({
      name: 'GET /oauth/end_session default redirect smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [302],
      request: requestDefaultEndSessionRedirect,
    });
  });

  test('redirects to a registered post_logout_redirect_uri through the real route', async () => {
    await runHttpPerf({
      name: 'GET /oauth/end_session post-logout redirect smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [302],
      request: requestRegisteredPostLogoutRedirect,
    });
  });
});
