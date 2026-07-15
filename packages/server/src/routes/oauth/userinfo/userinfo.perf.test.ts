import { testClient } from 'hono/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import type { AppType } from '../../../entrypoints/app.js';
import {
  assertJsonBody,
  createTestApp,
  getAccessToken,
  MINIMAL_TEST_CONFIG,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_USER_CONFIG,
} from '../../../test-utils/index.js';
import {
  deferPerfResponseValidation,
  runHttpPerf,
} from '../../../test-utils/perf/index.js';

const WARMUP_REQUESTS = 10;
const MEASURED_REQUESTS = 50;

let app: AppType;
let client: ReturnType<typeof testClient<AppType>>;
let cleanup: () => Promise<void> = async () => {};

async function setupPerfApp(): Promise<void> {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
    clients: [TEST_OAUTH_CLIENT_CONFIG],
  });

  app = server.app;
  client = testClient(app);
  cleanup = server.cleanup;
}

async function resetPerfApp(): Promise<void> {
  await cleanup();
  cleanup = async () => {};
  await setupPerfApp();
}

beforeEach(async () => {
  await setupPerfApp();
});

afterEach(async () => {
  await cleanup();
});

async function requestFullClaimsUserInfo(accessToken: string) {
  const response = await client.oauth.userinfo.$get({
    header: { authorization: `Bearer ${accessToken}` },
  });
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(body).toEqual({
      sub: TEST_USER_CONFIG.sub,
      email: TEST_USER_CONFIG.email,
      email_verified: true,
      name: TEST_USER_CONFIG.email,
      preferred_username: TEST_USER_CONFIG.email,
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
  });
}

async function requestPostFullClaimsUserInfo(accessToken: string) {
  const response = await client.oauth.userinfo.$post({
    header: { authorization: `Bearer ${accessToken}` },
  });
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(body).toEqual({
      sub: TEST_USER_CONFIG.sub,
      email: TEST_USER_CONFIG.email,
      email_verified: true,
      name: TEST_USER_CONFIG.email,
      preferred_username: TEST_USER_CONFIG.email,
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
  });
}

async function requestOpenIdOnlyUserInfo(accessToken: string) {
  const response = await client.oauth.userinfo.$get({
    header: { authorization: `Bearer ${accessToken}` },
  });
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(body).toEqual({ sub: TEST_USER_CONFIG.sub });
  });
}

async function requestMissingBearerUserInfo() {
  const response = await client.oauth.userinfo.$get({ header: {} });
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response, 401);
    expect(body.code).toBe('MISSING_AUTHORIZATION_HEADER');
  });
}

describe('GET /oauth/userinfo perf', () => {
  test('handles repeated full-claims requests with a pre-issued bearer token', async () => {
    const accessToken = await getAccessToken(app, {
      scope: 'openid profile email',
    });

    await runHttpPerf({
      name: 'GET /oauth/userinfo full claims smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [200],
      request: async () => requestFullClaimsUserInfo(accessToken),
    });
  });

  test('does not grow pathologically when granted claims increase', async () => {
    const openIdOnlyToken = await getAccessToken(app, { scope: 'openid' });

    const openIdOnlyResult = await runHttpPerf({
      name: 'GET /oauth/userinfo openid-only claims',
      warmupRequests: 3,
      requests: 30,
      concurrency: 3,
      expectedStatuses: [200],
      request: async () => requestOpenIdOnlyUserInfo(openIdOnlyToken),
    });

    await resetPerfApp();
    const fullClaimsToken = await getAccessToken(app, {
      scope: 'openid profile email',
    });

    const fullClaimsResult = await runHttpPerf({
      name: 'GET /oauth/userinfo full claims scaling',
      warmupRequests: 3,
      requests: 30,
      concurrency: 3,
      expectedStatuses: [200],
      request: async () => requestFullClaimsUserInfo(fullClaimsToken),
    });

    expect(fullClaimsResult.p95Ms).toBeLessThan(
      openIdOnlyResult.p95Ms * 5 + 100,
    );
  });

  test('handles missing bearer token failures through the real route', async () => {
    await runHttpPerf({
      name: 'GET /oauth/userinfo missing bearer smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [401],
      request: requestMissingBearerUserInfo,
    });
  });
});

describe('POST /oauth/userinfo perf', () => {
  test('handles repeated full-claims POST requests with a pre-issued bearer token', async () => {
    const accessToken = await getAccessToken(app, {
      scope: 'openid profile email',
    });

    await runHttpPerf({
      name: 'POST /oauth/userinfo full claims smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [200],
      request: async () => requestPostFullClaimsUserInfo(accessToken),
    });
  });
});
