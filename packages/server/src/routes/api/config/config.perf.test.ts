import { testClient } from 'hono/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import type { AppType } from '../../../entrypoints/app.js';
import { genericOAuth } from '../../../entrypoints/identity-providers/generic-oauth.js';
import { google } from '../../../entrypoints/identity-providers/google.js';
import {
  assertJsonBody,
  createTestApp,
  MINIMAL_TEST_CONFIG,
} from '../../../test-utils/index.js';
import {
  deferPerfResponseValidation,
  runHttpPerf,
} from '../../../test-utils/perf/index.js';

let app: AppType;
let client: ReturnType<typeof testClient<AppType>>;
let cleanup: () => Promise<void> = async () => {};
const SCALE_PROVIDER_COUNT = 50;

beforeEach(async () => {
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
  client = testClient(app);
  cleanup = server.cleanup;
});

afterEach(async () => {
  await cleanup();
});

async function requestConfig() {
  const response = await client.api.config.$get();
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(response.status).toBe(200);
    expect(body.i18n.supported_languages).toBeInstanceOf(Array);
    expect(body.registration.public_registration).toBe(true);
    expect(body.admin).toEqual({ enabled: true });
    expect(Array.isArray(body.identity_providers)).toBe(true);
    expect(body).not.toHaveProperty('security');
  });
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

async function requestScaledConfig(
  scaledClient: ReturnType<typeof testClient<AppType>>,
) {
  const response = await scaledClient.api.config.$get();
  return deferPerfResponseValidation(response, async () => {
    const payloadResponse = response.clone();
    const body = await assertJsonBody(response);
    const payload = await payloadResponse.text();
    expect(response.status).toBe(200);
    expect(body.identity_providers).toHaveLength(SCALE_PROVIDER_COUNT);
    expect(body).not.toHaveProperty('security');
    expect(payload.length).toBeGreaterThan(5_000);
    expect(payload.length).toBeLessThan(100_000);
  });
}

describe('GET /api/config perf', () => {
  test('handles repeated public config requests through the real route', async () => {
    await runHttpPerf({
      name: 'GET /api/config public smoke',
      warmupRequests: 5,
      requests: 50,
      concurrency: 5,
      request: requestConfig,
    });
  });

  test('handles larger public provider config responses without exposing secrets', async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      identity_providers: createScaleProviders(),
    });

    try {
      const scaledClient = testClient(server.app);
      await runHttpPerf({
        name: 'GET /api/config provider scale smoke',
        warmupRequests: 5,
        requests: 100,
        concurrency: 10,
        request: async () => requestScaledConfig(scaledClient),
      });
    } finally {
      await server.cleanup();
    }
  });
});
