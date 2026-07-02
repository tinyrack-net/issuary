import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '../../../entrypoints/app.js';
import type { TinyAuthRuntimeConfigInput } from '../../../lib/config/index.js';
import {
  assertJsonBody,
  createAuthenticatedSession,
  createTestApp,
  MINIMAL_TEST_CONFIG,
  TEST_USER_CONFIG,
} from '../../../test-utils/index.js';
import { runHttpPerf } from '../../../test-utils/perf/index.js';

const WARMUP_REQUESTS = 5;
const MEASURED_REQUESTS = 50;
const DEVICE_CLIENT: NonNullable<
  TinyAuthRuntimeConfigInput['clients']
>[number] = {
  id: 'device-perf-client',
  name: 'Device Perf Client',
  client_id: 'device-perf-client-id',
  client_secret: 'device-perf-client-secret',
  redirect_uris: ['http://localhost:8080/callback'],
  response_types: ['code'],
  grant_types: [
    'authorization_code',
    'urn:ietf:params:oauth:grant-type:device_code',
  ],
  scope: 'openid profile email',
};

let app: AppType;
let client: ReturnType<typeof testClient<AppType>>;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    clients: [DEVICE_CLIENT],
    users: [TEST_USER_CONFIG],
  });

  app = server.app;
  client = testClient(app);
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

async function requestDevicePage() {
  const response = await client.oauth.device.$get({
    query: { user_code: 'INVALID-CODE' },
  });
  const body = await response.text();

  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('text/html');
  expect(body).toContain('Sign in to approve the device.');
  expect(body).toContain('/login?return_to=');

  return response;
}

async function createDeviceUserCode(): Promise<string> {
  const credentials = Buffer.from(
    `${DEVICE_CLIENT.client_id}:${DEVICE_CLIENT.client_secret}`,
  ).toString('base64');
  const response = await client.oauth.device_authorization.$post(
    {
      form: { scope: 'openid profile' },
    },
    { headers: { authorization: `Basic ${credentials}` } },
  );
  const body = await assertJsonBody(response);

  expect(response.status).toBe(200);
  expect(body.user_code).toEqual(expect.any(String));

  if (!body.user_code) {
    throw new Error('Missing device user_code');
  }

  return body.user_code;
}

async function requestValidDevicePage(sessionCookie: string, userCode: string) {
  const response = await client.oauth.device.$get(
    { query: { user_code: userCode } },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  const body = await response.text();

  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('text/html');
  expect(body).toContain('Device Perf Client');
  expect(body).toContain('openid');
  expect(body).toContain('profile');

  return response;
}

async function requestValidDeviceApproval(
  sessionCookie: string,
  userCode: string,
) {
  const response = await client.oauth.device.$post(
    {
      form: {
        user_code: userCode,
        decision: 'approve',
      },
    },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  const body = await assertJsonBody(response);

  expect(response.status).toBe(200);
  expect(body.status).toBe('approved');
  expect(body.client_id).toBe(DEVICE_CLIENT.client_id);

  return response;
}

async function requestInvalidDeviceApproval(sessionCookie: string) {
  const response = await client.oauth.device.$post(
    {
      form: {
        user_code: 'INVALID-CODE',
        decision: 'approve',
      },
    },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  const body = await assertJsonBody(response, 400);

  expect(response.headers.get('content-type')).toContain('application/json');
  expect(body).toEqual(
    expect.objectContaining({
      error: 'invalid_grant',
      error_description: expect.any(String),
    }),
  );

  return response;
}

describe('OAuth device verification perf', () => {
  test('GET /oauth/device serves the unauthenticated verification page', async () => {
    const result = await runHttpPerf({
      name: 'GET /oauth/device invalid user-code smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [200],
      request: requestDevicePage,
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(5);
    expect(result.p95Ms).toBeLessThan(1000);
  });

  test('POST /oauth/device rejects an invalid user_code for an authenticated user', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    const result = await runHttpPerf({
      name: 'POST /oauth/device invalid user-code smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [400],
      request: async () => requestInvalidDeviceApproval(sessionCookie),
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[400]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(5);
    expect(result.p95Ms).toBeLessThan(1000);
  });

  test('GET /oauth/device renders pending device details for an authenticated user', async () => {
    const sessionCookie = await createAuthenticatedSession(app);
    const userCode = await createDeviceUserCode();

    const result = await runHttpPerf({
      name: 'GET /oauth/device valid user-code smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [200],
      request: async () => requestValidDevicePage(sessionCookie, userCode),
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(5);
    expect(result.p95Ms).toBeLessThan(1000);
  });

  test('POST /oauth/device approves pending device authorizations with isolated codes', async () => {
    const sessionCookie = await createAuthenticatedSession(app);
    const userCodes = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, () =>
        createDeviceUserCode(),
      ),
    );
    let nextUserCode = 0;

    const result = await runHttpPerf({
      name: 'POST /oauth/device valid approval smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [200],
      request: async () => {
        const userCode = userCodes[nextUserCode];
        nextUserCode += 1;
        if (!userCode) {
          throw new Error('Missing device approval user_code');
        }
        return requestValidDeviceApproval(sessionCookie, userCode);
      },
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(3);
    expect(result.p95Ms).toBeLessThan(1500);
  });
});
