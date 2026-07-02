import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '../../../entrypoints/app.js';
import type { TinyAuthRuntimeConfigInput } from '../../../lib/config/index.js';
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
const LARGE_TERMS_COUNT = 30;

let app: AppType;
let client: ReturnType<typeof testClient<AppType>>;
let services: ServiceContainer;
let cleanup: () => Promise<void> = async () => {};
let emailCounter = 0;

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    terms: [...TEST_TERMS_CONFIG],
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

async function requestTerms() {
  const response = await client.api.terms.$get({ query: {} });
  const body = await assertJsonBody(response);

  expect(response.status).toBe(200);
  expect(Array.isArray(body.terms)).toBe(true);
  expect(Array.isArray(body.pendingTerms)).toBe(true);
  expect(body.terms.length).toBeGreaterThan(0);
  const firstTerm = body.terms[0];
  if (firstTerm === undefined) {
    throw new Error('Expected at least one term');
  }
  expect(firstTerm).toHaveProperty('id');
  expect(firstTerm).toHaveProperty('consentMode');

  return response;
}

async function requestAuthenticatedTerms(sessionCookie: string) {
  const response = await client.api.terms.$get(
    { query: { lang: 'ko' } },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  const body = await assertJsonBody(response);

  expect(response.status).toBe(200);
  expect(body.terms).toHaveLength(2);
  expect(body.pendingTerms).toEqual([]);
  const firstTerm = body.terms[0];
  if (firstTerm === undefined) {
    throw new Error('Expected at least one authenticated term');
  }
  expect(firstTerm.userConsent).toEqual(
    expect.objectContaining({
      agreed: true,
      requiresUpdate: false,
    }),
  );

  return response;
}

async function requestTermsConsent(sessionCookie: string) {
  const response = await client.api.terms.consent.$post(
    {
      json: {
        consents: [
          { termsId: 'tos', agreed: true },
          { termsId: 'privacy', agreed: true },
        ],
      },
    },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  const body = await assertJsonBody(response);

  expect(response.status).toBe(200);
  expect(body.ok).toBe(true);
  expect(body.recorded).toBe(2);

  return response;
}

function createLargeTermsConfig(): NonNullable<
  TinyAuthRuntimeConfigInput['terms']
> {
  return Array.from({ length: LARGE_TERMS_COUNT }, (_, index) => ({
    id: `large-terms-${index}`,
    required: index % 3 !== 0,
    consent_mode: index % 5 === 0 ? 'implicit' : 'explicit',
    version: `2026.${index}.0`,
    content: {
      ko: {
        title: `대용량 약관 ${index}`,
        type: 'text',
        content: `한국어 약관 본문 ${index}. ${'반복 본문 '.repeat(80)}`,
      },
      en: {
        title: `Large Terms ${index}`,
        type: 'text',
        content: `English terms body ${index}. ${'Repeated body '.repeat(80)}`,
      },
      ja: {
        title: `大規模規約 ${index}`,
        type: 'text',
        content: `日本語規約本文 ${index}. ${'繰り返し本文 '.repeat(80)}`,
      },
    },
  }));
}

async function requestLargeTerms(
  largeTermsClient: ReturnType<typeof testClient<AppType>>,
) {
  const response = await largeTermsClient.api.terms.$get({
    query: { lang: 'ja' },
  });
  const payloadResponse = response.clone();
  const body = await assertJsonBody(response);
  const payload = await payloadResponse.text();

  expect(response.status).toBe(200);
  expect(body.terms).toHaveLength(LARGE_TERMS_COUNT);
  const firstTerm = body.terms[0];
  if (firstTerm === undefined) {
    throw new Error('Expected at least one large term');
  }
  expect(firstTerm.type).toBe('text');
  expect(payload.length).toBeGreaterThan(20_000);
  expect(payload.length).toBeLessThan(300_000);

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

  test('GET /api/terms includes authenticated consent history without pending required terms', async () => {
    const sessions = await Promise.all(
      Array.from({ length: TOTAL_REQUESTS }, async (_, index) => {
        const { sessionCookie } = await createDbUserWithSession(
          app,
          services,
          uniqueEmail(`terms-authenticated-perf-${index}`),
          'password123!',
        );
        await requestTermsConsent(sessionCookie);
        return sessionCookie;
      }),
    );

    const result = await runHttpPerf({
      name: 'GET /api/terms authenticated consent-history smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 4,
      request: async () => requestAuthenticatedTerms(nextItem(sessions)),
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(1);
    expect(result.p95Ms).toBeLessThan(2000);
  });

  test('GET /api/terms handles larger localized inline text terms payloads', async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      terms: createLargeTermsConfig(),
    });

    try {
      const largeTermsClient = testClient(server.app);
      const result = await runHttpPerf({
        name: 'GET /api/terms large localized text smoke',
        warmupRequests: 5,
        requests: 50,
        concurrency: 5,
        request: async () => requestLargeTerms(largeTermsClient),
      });

      expect(result.totalRequests).toBe(50);
      expect(result.failed).toBe(0);
      expect(result.statusCounts[200]).toBe(50);
      expect(result.errorRate).toBe(0);
      expect(result.rps).toBeGreaterThan(3);
      expect(result.p95Ms).toBeLessThan(1500);
    } finally {
      await server.cleanup();
    }
  });
});
