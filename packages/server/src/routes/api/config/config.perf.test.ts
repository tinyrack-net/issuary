import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '../../../entrypoints/app.js';
import { genericOAuth } from '../../../entrypoints/identity-providers/generic-oauth.js';
import { google } from '../../../entrypoints/identity-providers/google.js';
import {
  assertJsonBody,
  createTestApp,
  MINIMAL_TEST_CONFIG,
} from '../../../test-utils/index.js';
import { runHttpPerf } from '../../../test-utils/perf/index.js';

let app: AppType;
let cleanup: () => Promise<void> = async () => {};
const SCALE_PROVIDER_COUNT = 50;

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    admin: { enabled: true },
    registration: { enabled: true },
    identity_providers: [
      google({
        id: 'google',
        enabled: true,
        display_name: 'Google',
        client_id: 'test-google-client-id',
        client_secret: 'test-google-client-secret',
        email_conflict_strategy: 'auto_link',
      }),
    ],
  });
  app = server.app;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

async function requestConfig() {
  const response = await app.request('/api/config');
  const body = await assertJsonBody(response);

  expect(response.status).toBe(200);
  expect(body.i18n.supported_languages).toBeInstanceOf(Array);
  expect(body.registration.public_registration).toBe(true);
  expect(body.admin).toEqual({ enabled: true });
  expect(Array.isArray(body.identity_providers)).toBe(true);
  expect(body).not.toHaveProperty('security');

  return response;
}

function createScaleProviders() {
  return Array.from({ length: SCALE_PROVIDER_COUNT }, (_, index) =>
    genericOAuth({
      id: `generic-provider-${index}`,
      enabled: true,
      display_name: `Generic Provider ${index}`,
      icon_url: `https://example.com/provider-${index}.svg`,
      client_id: `generic-provider-client-${index}`,
      client_secret: `generic-provider-secret-${index}`,
      authorization_url: `https://provider-${index}.example.com/oauth/authorize`,
      token_url: `https://provider-${index}.example.com/oauth/token`,
      userinfo_url: `https://provider-${index}.example.com/oauth/userinfo`,
      scopes: ['openid', 'profile', 'email'],
      email_conflict_strategy: 'auto_link',
      userinfo_mapping: {
        id: 'sub',
        email: 'email',
        email_verified: 'email_verified',
        name: 'name',
        picture: 'picture',
      },
    }),
  );
}

async function requestScaledConfig(scaledApp: AppType) {
  const response = await scaledApp.request('/api/config');
  const body: { identity_providers?: unknown[]; security?: unknown } =
    await response.clone().json();
  const payload = await response.clone().text();

  expect(response.status).toBe(200);
  expect(body.identity_providers).toHaveLength(SCALE_PROVIDER_COUNT);
  expect(body.security).toBeUndefined();
  expect(payload.length).toBeGreaterThan(5_000);
  expect(payload.length).toBeLessThan(100_000);

  return response;
}

describe('GET /api/config perf', () => {
  test('handles repeated public config requests through the real route', async () => {
    const result = await runHttpPerf({
      name: 'GET /api/config public smoke',
      warmupRequests: 5,
      requests: 50,
      concurrency: 5,
      request: requestConfig,
    });

    expect(result.totalRequests).toBe(50);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(50);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(5);
    expect(result.p95Ms).toBeLessThan(1000);
  });

  test('handles larger public provider config responses without exposing secrets', async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      identity_providers: createScaleProviders(),
    });

    try {
      const result = await runHttpPerf({
        name: 'GET /api/config provider scale smoke',
        warmupRequests: 5,
        requests: 100,
        concurrency: 10,
        request: async () => requestScaledConfig(server.app),
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
