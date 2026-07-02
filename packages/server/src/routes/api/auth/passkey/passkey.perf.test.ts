import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';

import type { AppType } from '../../../../entrypoints/app.js';
import type { ServiceContainer } from '../../../../services/container.js';
import {
  assertJsonBody,
  createDbUserWithSession,
  createTestApp,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  withMikroContext,
} from '../../../../test-utils/index.js';
import { runHttpPerf } from '../../../../test-utils/perf/index.js';

const WARMUP_REQUESTS = 1;
const MEASURED_REQUESTS = 10;

const webauthn = vi.hoisted(() => ({
  verifyAuthenticationResponse: vi.fn(),
}));

vi.mock('@simplewebauthn/server', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@simplewebauthn/server')>();
  return {
    ...actual,
    verifyAuthenticationResponse: webauthn.verifyAuthenticationResponse,
  };
});

let app: AppType;
let client: ReturnType<typeof testClient<AppType>>;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  webauthn.verifyAuthenticationResponse.mockResolvedValue({
    verified: true,
    authenticationInfo: { newCounter: 1 },
  });

  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    auth: {
      passkey: {
        enabled: true,
      },
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

function createMockAuthenticationResponse(overrides?: {
  id?: string;
  rawId?: string;
}) {
  const credentialId = overrides?.id ?? 'mock-credential-id';
  const credentialType: 'public-key' = 'public-key';
  const clientExtensionResults: Record<string, unknown> = {};

  return {
    id: credentialId,
    rawId: overrides?.rawId ?? credentialId,
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
    type: credentialType,
    clientExtensionResults,
  };
}

async function createPasskeyAuthenticationFixture(index: number) {
  const credentialId = `auth-passkey-perf-credential-${index}`;
  const fixture = await createDbUserWithSession(
    app,
    services,
    generateUniqueEmail(`auth-passkey-perf-${index}`),
    'Password123!',
  );

  await withMikroContext(services, async () => {
    const passkey = services.mikro.userPasskey.create({
      user: fixture.userSub,
      credential_id: credentialId,
      public_key: 'AQIDBA',
      counter: 0,
      device_type: 'multiDevice',
      backed_up: true,
      transports: ['internal'],
      name: 'Perf Authentication Passkey',
      aaguid: 'perf-aaguid',
    });
    await services.mikro.em.persist(passkey).flush();
  });

  const optionsResponse = await client.api.auth.passkey.options.$post();
  expect(optionsResponse.status).toBe(200);

  return {
    credentialId,
    sessionCookie: extractCookie(optionsResponse, 'session'),
    userSub: fixture.userSub,
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
  const response = await client.api.auth.passkey.options.$post();
  const body = await assertJsonBody(response);

  expect(body.options?.challenge).toEqual(expect.any(String));
  expect(body.options?.rpId).toBe('localhost');
  expect(body.options?.allowCredentials).toHaveLength(0);
  expect(extractCookie(response, 'session')).toEqual(expect.any(String));

  return response;
}

async function requestPasskeyVerifyWithoutChallenge() {
  const response = await client.api.auth.passkey.verify.$post({
    json: {
      response: createMockAuthenticationResponse(),
    },
  });
  const body = await assertJsonBody(response, 400);

  expect(body.code).toBe('PASSKEY_CHALLENGE_NOT_FOUND');

  return response;
}

async function requestPasskeyVerifySuccess(fixture: {
  credentialId: string;
  sessionCookie: string;
  userSub: string;
}) {
  const response = await client.api.auth.passkey.verify.$post(
    {
      json: {
        response: createMockAuthenticationResponse({
          id: fixture.credentialId,
          rawId: fixture.credentialId,
        }),
      },
    },
    { headers: { Cookie: `session=${fixture.sessionCookie}` } },
  );
  const body = await assertJsonBody(response);

  expect(body.user?.sub).toBe(fixture.userSub);
  expect(extractCookie(response, 'session')).toEqual(expect.any(String));

  return response;
}

describe('POST /api/auth/passkey/options perf', () => {
  test('smoke handles repeated authentication options requests through the real route', async () => {
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
  test('smoke authenticates pre-created passkeys through the real route', async () => {
    const fixtures = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, (_, index) =>
        createPasskeyAuthenticationFixture(index),
      ),
    );
    let nextFixture = 0;

    const result = await runHttpPerf({
      name: 'POST /api/auth/passkey/verify success smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      request: async () => {
        const fixture = fixtures[nextFixture];
        nextFixture += 1;
        if (!fixture) {
          throw new Error('Missing passkey authentication fixture');
        }
        return requestPasskeyVerifySuccess(fixture);
      },
    });

    expectPerfResult(result, 200);
  });

  test('smoke handles missing-challenge validation failure through the real route', async () => {
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
