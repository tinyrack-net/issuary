import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';

import type { AppType } from '../../../../entrypoints/app.js';
import type { ServiceContainer } from '../../../../services/container.js';
import {
  assertJsonBody,
  createDbUserWithSession,
  createPasskeyForUser,
  createTestApp,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_USER_CONFIG,
  withMikroContext,
} from '../../../../test-utils/index.js';
import { runHttpPerf } from '../../../../test-utils/perf/index.js';

const WARMUP_REQUESTS = 1;
const MEASURED_REQUESTS = 10;

const webauthn = vi.hoisted(() => ({
  verifyRegistrationResponse: vi.fn(),
}));

vi.mock('@simplewebauthn/server', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@simplewebauthn/server')>();
  return {
    ...actual,
    verifyRegistrationResponse: webauthn.verifyRegistrationResponse,
  };
});

let app: AppType;
let client: ReturnType<typeof testClient<AppType>>;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeAll(async () => {
  webauthn.verifyRegistrationResponse.mockImplementation(async () => ({
    verified: true,
    registrationInfo: {
      credential: {
        id: `perf-registration-credential-${crypto.randomUUID()}`,
        publicKey: Buffer.from([1, 2, 3, 4]),
        counter: 0,
      },
      credentialDeviceType: 'multiDevice',
      credentialBackedUp: true,
      aaguid: 'perf-aaguid',
    },
  }));

  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
    registration: {
      email_verification_required: true,
    },
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

function createMockRegistrationResponse() {
  const credentialId = `mock-registration-credential-${crypto.randomUUID()}`;
  return {
    id: credentialId,
    rawId: credentialId,
    response: {
      clientDataJSON: Buffer.from(
        JSON.stringify({
          type: 'webauthn.create',
          challenge: 'mock-challenge',
          origin: 'http://localhost:8080',
        }),
      ).toString('base64url'),
      attestationObject: 'mock-attestation-object',
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

async function createSession(index: number) {
  return createDbUserWithSession(
    app,
    services,
    generateUniqueEmail(`user-passkeys-perf-${index}`),
    'Password123!',
  );
}

async function createSessionWithPasskey(index: number, name: string | null) {
  const fixture = await createSession(index);
  const passkeyId = await createPasskeyForUser(services, fixture.userSub, name);

  return {
    sessionCookie: fixture.sessionCookie,
    passkeyId,
  };
}

async function requestListPasskeys(sessionCookie: string) {
  const response = await client.api.user.passkeys.$get(
    {},
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  const body = await assertJsonBody(response);

  expect(body.passkeys).toHaveLength(1);
  expect(body.passkeys?.[0]?.name).toBe('Perf List Passkey');

  return response;
}

async function requestRegisterOptions(sessionCookie: string) {
  const response = await client.api.user.passkeys.register.options.$post(
    {},
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  const body = await assertJsonBody(response);

  expect(body.options?.challenge).toEqual(expect.any(String));
  expect(body.options?.user?.name).toEqual(expect.any(String));
  expect(body.options?.pubKeyCredParams?.length).toBeGreaterThan(0);
  expect(body.options?.excludeCredentials).toHaveLength(0);
  expect(extractCookie(response, 'session')).toEqual(expect.any(String));

  return response;
}

async function requestRegisterVerifyWithoutChallenge(sessionCookie: string) {
  const response = await client.api.user.passkeys.register.verify.$post(
    {
      json: {
        response: createMockRegistrationResponse(),
        name: 'Perf Passkey',
      },
    },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  const body = await assertJsonBody(response, 400);

  expect(body.code).toBe('PASSKEY_CHALLENGE_NOT_FOUND');

  return response;
}

async function createPasskeyRegistrationFixture(index: number) {
  const fixture = await createSession(index);
  const optionsResponse = await client.api.user.passkeys.register.options.$post(
    {},
    { headers: { Cookie: `session=${fixture.sessionCookie}` } },
  );
  expect(optionsResponse.status).toBe(200);

  return {
    sessionCookie: extractCookie(optionsResponse, 'session'),
    userSub: fixture.userSub,
  };
}

async function requestRegisterVerifySuccess(fixture: {
  sessionCookie: string;
  userSub: string;
}) {
  const response = await client.api.user.passkeys.register.verify.$post(
    {
      json: {
        response: createMockRegistrationResponse(),
        name: 'Perf Registered Passkey',
      },
    },
    { headers: { Cookie: `session=${fixture.sessionCookie}` } },
  );
  const body = await assertJsonBody(response);

  expect(body.ok).toBe(true);
  expect(body.second_factor_setup_completed).toBe(false);

  const passkeys = await withMikroContext(services, () =>
    services.passkeyService.getUserPasskeys(fixture.userSub),
  );
  expect(
    passkeys.some((passkey) => passkey.name === 'Perf Registered Passkey'),
  ).toBe(true);

  return response;
}

async function requestRenamePasskey(
  sessionCookie: string,
  passkeyId: string,
  name: string,
) {
  const response = await client.api.user.passkeys[':id'].$patch(
    {
      param: { id: passkeyId },
      json: { name },
    },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  const body = await assertJsonBody(response);

  expect(body.ok).toBe(true);

  return response;
}

async function requestDeletePasskey(sessionCookie: string, passkeyId: string) {
  const response = await client.api.user.passkeys[':id'].$delete(
    { param: { id: passkeyId } },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  const body = await assertJsonBody(response);

  expect(body.ok).toBe(true);

  return response;
}

describe('GET /api/user/passkeys perf', () => {
  test('handles repeated passkey list requests through the real route', async () => {
    const fixture = await createSessionWithPasskey(0, 'Perf List Passkey');

    const result = await runHttpPerf({
      name: 'GET /api/user/passkeys smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      request: async () => requestListPasskeys(fixture.sessionCookie),
    });

    expectPerfResult(result, 200);
  });
});

describe('POST /api/user/passkeys/register/options perf', () => {
  test('handles repeated registration options requests through the real route', async () => {
    const fixture = await createSession(100);

    const result = await runHttpPerf({
      name: 'POST /api/user/passkeys/register/options smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      request: async () => requestRegisterOptions(fixture.sessionCookie),
    });

    expectPerfResult(result, 200);
  });
});

describe('POST /api/user/passkeys/register/verify perf', () => {
  test('registers passkeys for authenticated users through the real route', async () => {
    const fixtures = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, (_, index) =>
        createPasskeyRegistrationFixture(index + 200),
      ),
    );
    let nextFixture = 0;

    const result = await runHttpPerf({
      name: 'POST /api/user/passkeys/register/verify success smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      request: async () => {
        const fixture = fixtures[nextFixture];
        nextFixture += 1;
        if (!fixture) {
          throw new Error('Missing passkey registration fixture');
        }
        return requestRegisterVerifySuccess(fixture);
      },
    });

    expectPerfResult(result, 200);
  });

  test('handles missing-challenge validation failure through the real route', async () => {
    const fixture = await createSession(200);

    const result = await runHttpPerf({
      name: 'POST /api/user/passkeys/register/verify missing-challenge smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      expectedStatuses: [400],
      request: async () =>
        requestRegisterVerifyWithoutChallenge(fixture.sessionCookie),
    });

    expectPerfResult(result, 400);
  });
});

describe('PATCH /api/user/passkeys/:id perf', () => {
  test('handles repeated passkey rename requests through the real route', async () => {
    const fixture = await createSessionWithPasskey(300, 'Perf Rename Passkey');
    let requestIndex = 0;

    const result = await runHttpPerf({
      name: 'PATCH /api/user/passkeys/:id smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      request: async () => {
        requestIndex += 1;
        return requestRenamePasskey(
          fixture.sessionCookie,
          fixture.passkeyId,
          `Perf Rename Passkey ${requestIndex}`,
        );
      },
    });

    expectPerfResult(result, 200);
  });
});

describe('DELETE /api/user/passkeys/:id perf', () => {
  test('handles pre-created passkey deletions through the real route', async () => {
    const fixtures = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, (_, index) =>
        createSessionWithPasskey(index + 400, 'Perf Delete Passkey'),
      ),
    );
    let nextFixture = 0;

    const result = await runHttpPerf({
      name: 'DELETE /api/user/passkeys/:id smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      request: async () => {
        const fixture = fixtures[nextFixture];
        nextFixture += 1;
        if (!fixture) {
          throw new Error('Missing passkey delete fixture');
        }
        return requestDeletePasskey(fixture.sessionCookie, fixture.passkeyId);
      },
    });

    expectPerfResult(result, 200);
  });
});
