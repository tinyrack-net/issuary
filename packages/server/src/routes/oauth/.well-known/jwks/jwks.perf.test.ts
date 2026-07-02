import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { JwtKeyStatus } from '#server/entities/jwt-key.entity.js';
import type { AppType } from '#server/entrypoints/app.js';
import type { ServiceContainer } from '#server/services/container.js';
import {
  assertJsonBody,
  createJwtKey,
  createTestApp,
  MINIMAL_TEST_CONFIG,
} from '#server/test-utils/index.js';
import { runHttpPerf } from '#server/test-utils/perf/index.js';

const WARMUP_REQUESTS = 5;
const MEASURED_REQUESTS = 50;
const PREVIOUS_KEY_COUNT = 5;

let app: AppType;
let client: ReturnType<typeof testClient<AppType>>;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp(MINIMAL_TEST_CONFIG);

  app = server.app;
  client = testClient(app);
  services = server.services;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

async function requestJwks() {
  const response = await client.oauth['.well-known'].jwks.$get();
  const body = await assertJsonBody(response.clone());

  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('application/json');
  expect(response.headers.get('cache-control')).toBe('public, max-age=3600');
  expect(body).toEqual({
    keys: expect.arrayContaining([
      expect.objectContaining({
        kty: 'RSA',
        use: 'sig',
        kid: expect.any(String),
        alg: 'RS256',
        n: expect.any(String),
        e: expect.any(String),
      }),
    ]),
  });

  return response;
}

async function createPreviousJwtKeys(count: number) {
  await Promise.all(
    Array.from({ length: count }, async (_, index) =>
      createJwtKey(services, {
        status: JwtKeyStatus.PREVIOUS,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        activatedAt: new Date(Date.now() - (index + 2) * 60 * 60 * 1000),
        deactivatedAt: new Date(Date.now() - (index + 1) * 60 * 60 * 1000),
      }),
    ),
  );
}

async function requestJwksWithPreviousKeys() {
  const response = await requestJwks();
  const body = await assertJsonBody(response.clone());

  expect(body.keys).toEqual(expect.any(Array));
  expect(body.keys?.length).toBeGreaterThanOrEqual(PREVIOUS_KEY_COUNT + 1);

  return response;
}

describe('GET /oauth/.well-known/jwks perf', () => {
  test('serves signing key metadata through the real route', async () => {
    const result = await runHttpPerf({
      name: 'GET /oauth/.well-known/jwks smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [200],
      request: requestJwks,
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(5);
    expect(result.p95Ms).toBeLessThan(1000);
  });

  test('serves active and previous signing keys through the real route', async () => {
    await createPreviousJwtKeys(PREVIOUS_KEY_COUNT);

    const result = await runHttpPerf({
      name: 'GET /oauth/.well-known/jwks rotated keys smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [200],
      request: requestJwksWithPreviousKeys,
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(5);
    expect(result.p95Ms).toBeLessThan(1500);
  });
});
