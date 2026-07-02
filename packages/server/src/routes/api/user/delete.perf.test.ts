import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '../../../entrypoints/app.js';
import type { ServiceContainer } from '../../../services/container.js';
import {
  assertJsonBody,
  createDbUserWithSession,
  createTestApp,
  MINIMAL_TEST_CONFIG,
} from '../../../test-utils/index.js';
import { runHttpPerf } from '../../../test-utils/perf/index.js';

const WARMUP_REQUESTS = 3;
const MEASURED_REQUESTS = 20;
const TOTAL_REQUESTS = WARMUP_REQUESTS + MEASURED_REQUESTS;

let app: AppType;
let client: ReturnType<typeof testClient<AppType>>;
let services: ServiceContainer;
let cleanup: () => Promise<void> = async () => {};
let emailCounter = 0;

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    account_deletion: {
      enabled: true,
      retention: '30d',
    },
  });
  app = server.app;
  client = testClient(app);
  services = server.services;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

function nextItem<T>(items: T[]): T {
  const item = items.shift();
  if (item === undefined) {
    throw new Error('Missing pre-created perf fixture');
  }
  return item;
}

function uniqueEmail(prefix: string): string {
  emailCounter += 1;
  return `${prefix}-${Date.now()}-${emailCounter}-${crypto.randomUUID()}@example.com`;
}

async function requestDeleteUser(sessionCookie: string) {
  const response = await client.api.user.$delete(
    {},
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  const body = await assertJsonBody(response);

  expect(response.status).toBe(200);
  expect(body.ok).toBe(true);
  expect(body.deleted_at).toEqual(expect.any(String));
  expect(body.permanent_deletion_at).toEqual(expect.any(String));

  return response;
}

describe('DELETE /api/user perf', () => {
  test('handles pre-created account deletion sessions through the real route', async () => {
    const sessions = await Promise.all(
      Array.from({ length: TOTAL_REQUESTS }, async () => {
        const { sessionCookie } = await createDbUserWithSession(
          app,
          services,
          uniqueEmail('delete-user-perf'),
          'password123!',
        );
        return sessionCookie;
      }),
    );

    const result = await runHttpPerf({
      name: 'DELETE /api/user authenticated delete smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 4,
      request: async () => requestDeleteUser(nextItem(sessions)),
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(1);
    expect(result.p95Ms).toBeLessThan(2000);
  });
});
