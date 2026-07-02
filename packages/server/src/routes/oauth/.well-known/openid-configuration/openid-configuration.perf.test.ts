import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '#server/entrypoints/app.js';
import {
  createTestApp,
  MINIMAL_TEST_CONFIG,
} from '#server/test-utils/index.js';
import { runHttpPerf } from '#server/test-utils/perf/index.js';

const WARMUP_REQUESTS = 5;
const MEASURED_REQUESTS = 50;

let app: AppType;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp(MINIMAL_TEST_CONFIG);

  app = server.app;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

async function requestOpenidConfiguration(path: string) {
  const response = await app.request(path);
  const body = await response.clone().json();

  expect(response.status).toBe(200);
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
      request: async () =>
        requestOpenidConfiguration('/.well-known/openid-configuration'),
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
      request: async () =>
        requestOpenidConfiguration('/oauth/.well-known/openid-configuration'),
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(5);
    expect(result.p95Ms).toBeLessThan(1000);
  });
});
