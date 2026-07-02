import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '../../../entrypoints/app.js';
import { google } from '../../../entrypoints/identity-providers/google.js';
import {
  assertJsonBody,
  createTestApp,
  MINIMAL_TEST_CONFIG,
} from '../../../test-utils/index.js';
import { runHttpPerf } from '../../../test-utils/perf/index.js';

let app: AppType;
let cleanup: () => Promise<void> = async () => {};

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
});
