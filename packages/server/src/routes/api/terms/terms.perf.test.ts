import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '../../../entrypoints/app.js';
import type { ServiceContainer } from '../../../services/container.js';
import {
  assertJsonBody,
  createDbUserWithSession,
  createTestApp,
  MINIMAL_TEST_CONFIG,
  TEST_TERMS_CONFIG,
} from '../../../test-utils/index.js';
import { runHttpPerf } from '../../../test-utils/perf/index.js';

const WARMUP_REQUESTS = 3;
const MEASURED_REQUESTS = 20;
const TOTAL_REQUESTS = WARMUP_REQUESTS + MEASURED_REQUESTS;

let app: AppType;
let services: ServiceContainer;
let cleanup: () => Promise<void> = async () => {};
let emailCounter = 0;

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    terms: [...TEST_TERMS_CONFIG],
  });
  app = server.app;
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

async function requestTerms() {
  const response = await app.request('/api/terms');
  const body = await assertJsonBody(response);

  expect(response.status).toBe(200);
  expect(Array.isArray(body.terms)).toBe(true);
  expect(Array.isArray(body.pendingTerms)).toBe(true);
  expect(body.terms.length).toBeGreaterThan(0);
  expect(body.terms[0]).toHaveProperty('id');
  expect(body.terms[0]).toHaveProperty('consentMode');

  return response;
}

async function requestTermsConsent(sessionCookie: string) {
  const response = await app.request('/api/terms/consent', {
    method: 'POST',
    headers: {
      Cookie: `session=${sessionCookie}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      consents: [
        { termsId: 'tos', agreed: true },
        { termsId: 'privacy', agreed: true },
      ],
    }),
  });
  const body = await assertJsonBody(response);

  expect(response.status).toBe(200);
  expect(body.ok).toBe(true);
  expect(body.recorded).toBe(2);

  return response;
}

describe('terms API perf', () => {
  test('GET /api/terms handles repeated public terms requests through the real route', async () => {
    const result = await runHttpPerf({
      name: 'GET /api/terms public smoke',
      warmupRequests: 5,
      requests: 50,
      concurrency: 5,
      request: requestTerms,
    });

    expect(result.totalRequests).toBe(50);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(50);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(5);
    expect(result.p95Ms).toBeLessThan(1000);
  });

  test('POST /api/terms/consent handles pre-authenticated consent submissions', async () => {
    const sessions = await Promise.all(
      Array.from({ length: TOTAL_REQUESTS }, async () => {
        const { sessionCookie } = await createDbUserWithSession(
          app,
          services,
          uniqueEmail('terms-consent-perf'),
          'password123!',
        );
        return sessionCookie;
      }),
    );

    const result = await runHttpPerf({
      name: 'POST /api/terms/consent authenticated smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 4,
      request: async () => requestTermsConsent(nextItem(sessions)),
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(1);
    expect(result.p95Ms).toBeLessThan(2000);
  });
});
