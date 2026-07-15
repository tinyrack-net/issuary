import { testClient } from 'hono/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { JwtKeyStatus } from '#server/entities/jwt-key.entity.js';
import type { AppType } from '#server/entrypoints/app.js';
import type { ServiceContainer } from '#server/services/container.js';
import {
  assertJsonBody,
  createJwtKey,
  createTestApp,
  MINIMAL_TEST_CONFIG,
} from '#server/test-utils/index.js';
import {
  deferPerfResponseValidation,
  runHttpPerf,
} from '#server/test-utils/perf/index.js';

const WARMUP_REQUESTS = 10;
const MEASURED_REQUESTS = 50;
const PREVIOUS_KEY_COUNT = 5;

let app: AppType;
let client: ReturnType<typeof testClient<AppType>>;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  const server = await createTestApp(MINIMAL_TEST_CONFIG);

  app = server.app;
  client = testClient(app);
  services = server.services;
  cleanup = server.cleanup;
});

afterEach(async () => {
  await cleanup();
});

async function requestJwks() {
  const response = await client.oauth['.well-known'].jwks.$get();
  return deferPerfResponseValidation(response, async () => {
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
  });
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
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response.clone());
    expect(body.keys).toEqual(expect.any(Array));
    expect(body.keys?.length).toBeGreaterThanOrEqual(PREVIOUS_KEY_COUNT + 1);
  });
}

describe('GET /oauth/.well-known/jwks perf', () => {
  test('serves signing key metadata through the real route', async () => {
    await runHttpPerf({
      name: 'GET /oauth/.well-known/jwks smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [200],
      request: requestJwks,
    });
  });

  test('serves active and previous signing keys through the real route', async () => {
    await createPreviousJwtKeys(PREVIOUS_KEY_COUNT);

    await runHttpPerf({
      name: 'GET /oauth/.well-known/jwks rotated keys smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 5,
      expectedStatuses: [200],
      request: requestJwksWithPreviousKeys,
    });
  });
});
