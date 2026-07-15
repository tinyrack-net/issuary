import { testClient } from 'hono/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import type { AppType } from '../../../entrypoints/app.js';
import {
  assertJsonBody,
  createTestApp,
  MINIMAL_TEST_CONFIG,
} from '../../../test-utils/index.js';
import {
  deferPerfResponseValidation,
  runHttpPerf,
} from '../../../test-utils/perf/index.js';

const WARMUP_REQUESTS = 10;
const MEASURED_REQUESTS = 50;

const DEVICE_CLIENT = {
  clientId: 'device-perf-client',
  clientSecret: 'device-perf-client-secret',
};

const DEVICE_CLIENT_CONFIG = {
  id: 'device-perf-client-config',
  name: 'Device Perf Client',
  client_id: DEVICE_CLIENT.clientId,
  client_secret: DEVICE_CLIENT.clientSecret,
  redirect_uris: ['http://localhost:18082/device-perf/callback'],
  response_types: ['code'],
  grant_types: [
    'authorization_code',
    'urn:ietf:params:oauth:grant-type:device_code',
  ],
  scope: 'openid profile',
};

let app: AppType;
let client: ReturnType<typeof testClient<AppType>>;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    clients: [DEVICE_CLIENT_CONFIG],
  });

  app = server.app;
  client = testClient(app);
  cleanup = server.cleanup;
});

afterEach(async () => {
  await cleanup();
});

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64')}`;
}

async function requestDeviceAuthorization() {
  const response = await client.oauth.device_authorization.$post(
    {
      form: { scope: 'openid profile' },
    },
    {
      headers: {
        authorization: basicAuthHeader(
          DEVICE_CLIENT.clientId,
          DEVICE_CLIENT.clientSecret,
        ),
      },
    },
  );
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
    expect(body).toEqual({
      device_code: expect.any(String),
      user_code: expect.any(String),
      verification_uri: 'http://localhost:8080/oauth/device',
      verification_uri_complete: expect.stringContaining(
        'http://localhost:8080/oauth/device?user_code=',
      ),
      expires_in: 600,
      interval: 5,
    });
  });
}

describe('POST /oauth/device_authorization perf', () => {
  test('creates valid device authorization responses through the real route', async () => {
    await runHttpPerf({
      name: 'POST /oauth/device_authorization valid request smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [200],
      request: requestDeviceAuthorization,
    });
  });
});
