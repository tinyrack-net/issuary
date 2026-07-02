import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '#server/entrypoints/app.js';
import type { TinyAuthRuntimeConfigInput } from '#server/lib/config/index.js';
import {
  assertJsonBody,
  createTestApp,
  MINIMAL_TEST_CONFIG,
} from '#server/test-utils/index.js';
import { runHttpPerf } from '#server/test-utils/perf/index.js';

const WARMUP_REQUESTS = 5;
const MEASURED_REQUESTS = 50;
const SCALE_CLIENT_COUNT = 250;

let app: AppType;
let client: ReturnType<typeof testClient<AppType>>;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp(MINIMAL_TEST_CONFIG);

  app = server.app;
  client = testClient(app);
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

async function expectOpenidConfiguration(response: {
  status: number;
  headers: Headers;
  json(): Promise<unknown>;
}) {
  const body = await assertJsonBody(response);

  expect(response.headers.get('content-type')).toContain('application/json');
  expect(response.headers.get('cache-control')).toBe('public, max-age=3600');
  expect(body).toEqual(
    expect.objectContaining({
      issuer: 'http://localhost:8080',
      authorization_endpoint: 'http://localhost:8080/oauth/authorize',
      token_endpoint: 'http://localhost:8080/oauth/token',
      jwks_uri: 'http://localhost:8080/oauth/.well-known/jwks',
      userinfo_endpoint: 'http://localhost:8080/oauth/userinfo',
      introspection_endpoint: 'http://localhost:8080/oauth/introspect',
      revocation_endpoint: 'http://localhost:8080/oauth/revoke',
      end_session_endpoint: 'http://localhost:8080/oauth/end_session',
      device_authorization_endpoint:
        'http://localhost:8080/oauth/device_authorization',
      response_types_supported: expect.arrayContaining(['code']),
      subject_types_supported: expect.arrayContaining(['public']),
      id_token_signing_alg_values_supported: expect.arrayContaining(['RS256']),
      grant_types_supported: expect.arrayContaining([
        'authorization_code',
        'urn:ietf:params:oauth:grant-type:device_code',
      ]),
      code_challenge_methods_supported: expect.arrayContaining(['S256']),
    }),
  );
}

async function requestRootOpenidConfiguration() {
  const response = await client['.well-known']['openid-configuration'].$get();
  await expectOpenidConfiguration(response);
  return response;
}

async function requestOauthOpenidConfiguration() {
  const response =
    await client.oauth['.well-known']['openid-configuration'].$get();
  await expectOpenidConfiguration(response);
  return response;
}

function createScaleClients(): NonNullable<
  TinyAuthRuntimeConfigInput['clients']
> {
  return Array.from({ length: SCALE_CLIENT_COUNT }, (_, index) => ({
    id: `discovery-scale-client-${index}`,
    name: `Discovery Scale Client ${index}`,
    client_id: `discovery-scale-client-id-${index}`,
    client_secret: `discovery-scale-secret-${index}`.padEnd(32, 'x'),
    redirect_uris: [`http://localhost:8080/callback/${index}`],
    post_logout_redirect_uris: [`http://localhost:8080/logout/${index}`],
    web_origins: ['http://localhost:8080'],
    response_types: ['code'],
    grant_types: ['authorization_code', 'refresh_token'],
    scope: `openid profile email custom:${index} tenant:${index % 25}`,
  }));
}

async function requestScaledOpenidConfiguration(
  scaledClient: ReturnType<typeof testClient<AppType>>,
) {
  const response =
    await scaledClient['.well-known']['openid-configuration'].$get();
  const body = await assertJsonBody(response);
  const scopesSupported =
    typeof body === 'object' && body !== null && 'scopes_supported' in body
      ? body.scopes_supported
      : undefined;
  const payload = JSON.stringify(body);

  if (payload === undefined) {
    throw new Error('Missing OpenID configuration payload');
  }

  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('public, max-age=3600');
  expect(scopesSupported).toEqual(
    expect.arrayContaining(['custom:249', 'tenant:24']),
  );
  expect(payload.length).toBeGreaterThan(1_000);
  expect(payload.length).toBeLessThan(100_000);

  return response;
}

describe('OIDC discovery perf', () => {
  test('GET /.well-known/openid-configuration serves provider metadata', async () => {
    const result = await runHttpPerf({
      name: 'GET /.well-known/openid-configuration smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [200],
      request: requestRootOpenidConfiguration,
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(5);
    expect(result.p95Ms).toBeLessThan(1000);
  });

  test('GET /oauth/.well-known/openid-configuration serves provider metadata', async () => {
    const result = await runHttpPerf({
      name: 'GET /oauth/.well-known/openid-configuration smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [200],
      request: requestOauthOpenidConfiguration,
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(5);
    expect(result.p95Ms).toBeLessThan(1000);
  });

  test('GET /.well-known/openid-configuration handles larger client and scope configs', async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      clients: createScaleClients(),
    });

    try {
      const scaledClient = testClient(server.app);
      const result = await runHttpPerf({
        name: 'GET /.well-known/openid-configuration scaled clients',
        warmupRequests: 5,
        requests: 100,
        concurrency: 10,
        expectedStatuses: [200],
        request: async () => requestScaledOpenidConfiguration(scaledClient),
      });

      expect(result.totalRequests).toBe(100);
      expect(result.failed).toBe(0);
      expect(result.statusCounts[200]).toBe(100);
      expect(result.errorRate).toBe(0);
      expect(result.rps).toBeGreaterThan(10);
      expect(result.p95Ms).toBeLessThan(500);
    } finally {
      await server.cleanup();
    }
  });
});
