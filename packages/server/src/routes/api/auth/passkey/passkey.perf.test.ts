import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import type { AppType } from '../../../../entrypoints/app.js';
import {
  createTestApp,
  extractCookie,
  MINIMAL_TEST_CONFIG,
} from '../../../../test-utils/index.js';
import { runHttpPerf } from '../../../../test-utils/perf/index.js';

const WARMUP_REQUESTS = 1;
const MEASURED_REQUESTS = 10;

let app: AppType;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    auth: {
      passkey: {
        enabled: true,
      },
    },
  });
  app = server.app;
  cleanup = server.cleanup;
});

afterAll(async () => {
  await cleanup();
});

function createMockAuthenticationResponse() {
  return {
    id: 'mock-credential-id',
    rawId: 'mock-credential-id',
    response: {
      clientDataJSON: Buffer.from(
        JSON.stringify({
          type: 'webauthn.get',
          challenge: 'mock-challenge',
          origin: 'http://localhost:8080',
        }),
      ).toString('base64url'),
      authenticatorData: 'bW9jay1hdXRoZW50aWNhdG9yLWRhdGE',
      signature: 'bW9jay1zaWduYXR1cmU',
    },
    type: 'public-key',
    clientExtensionResults: {},
  };
}

function expectPerfResult(
  result: Awaited<ReturnType<typeof runHttpPerf>>,
  status: number,
) {
  expect(result.totalRequests).toBe(MEASURED_REQUESTS);
  expect(result.failed).toBe(0);
  expect(result.statusCounts[status]).toBe(MEASURED_REQUESTS);
  expect(result.errorRate).toBe(0);
  expect(result.rps).toBeGreaterThan(1);
  expect(result.p95Ms).toBeLessThan(3000);
}

async function requestPasskeyOptions() {
  const response = await app.request('/api/auth/passkey/options', {
    method: 'POST',
  });
  const body: {
    options?: {
      challenge?: string;
      rpId?: string;
      allowCredentials?: unknown[];
    };
  } = await response.clone().json();

  expect(response.status).toBe(200);
  expect(body.options?.challenge).toEqual(expect.any(String));
  expect(body.options?.rpId).toBe('localhost');
  expect(body.options?.allowCredentials).toHaveLength(0);
  expect(extractCookie(response, 'session')).toEqual(expect.any(String));

  return response;
}

async function requestPasskeyVerifyWithoutChallenge() {
  const response = await app.request('/api/auth/passkey/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      response: createMockAuthenticationResponse(),
    }),
  });
  const body: { code?: string } = await response.clone().json();

  expect(response.status).toBe(400);
  expect(body.code).toBe('PASSKEY_CHALLENGE_NOT_FOUND');

  return response;
}

describe('POST /api/auth/passkey/options perf', () => {
  test('handles repeated authentication options requests through the real route', async () => {
    const result = await runHttpPerf({
      name: 'POST /api/auth/passkey/options smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      request: requestPasskeyOptions,
    });

    expectPerfResult(result, 200);
  });
});

describe('POST /api/auth/passkey/verify perf', () => {
  test('handles validation failure without faking WebAuthn through the real route', async () => {
    const result = await runHttpPerf({
      name: 'POST /api/auth/passkey/verify missing-challenge smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      expectedStatuses: [400],
      request: requestPasskeyVerifyWithoutChallenge,
    });

    expectPerfResult(result, 400);
  });
});
