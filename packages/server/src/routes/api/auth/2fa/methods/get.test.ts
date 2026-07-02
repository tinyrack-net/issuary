import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '../../../../../entrypoints/app.ts';
import type { ServiceContainer } from '../../../../../services/container.ts';
import {
  assertJsonBody,
  createDbUserWithSession,
  createPasskeyForUser,
  createTestApp,
  enableTotpForUser,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
} from '../../../../../test-utils/index.ts';

async function createPending2FACookie(params: {
  app: AppType;
  email: string;
  password: string;
}): Promise<string> {
  const client = testClient(params.app);
  const loginRes = await client.api.auth.login.$post({
    json: {
      email: params.email,
      password: params.password,
    },
  });

  expect(loginRes.status).toBe(200);
  return extractCookie(loginRes, 'session');
}

async function createUserWithSecondFactors(params: {
  app: AppType;
  services: ServiceContainer;
  email: string;
  password: string;
}) {
  const { userSub } = await createDbUserWithSession(
    params.app,
    params.services,
    params.email,
    params.password,
  );

  await enableTotpForUser(params.services, userSub);
  await createPasskeyForUser(params.services, userSub, 'Test Passkey');
}

describe('GET /api/auth/2fa/methods', () => {
  let app: AppType;
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      auth: {
        password: {
          enabled: true,
          two_factor: {
            enrollment_required: true,
          },
          totp: {
            enabled: true,
          },
        },
        passkey: {
          enabled: true,
        },
      },
    });
    app = server.app;
    services = server.services;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('returns registered and enabled pending 2FA methods', async () => {
    const email = generateUniqueEmail('2fa-methods');
    const password = 'testPassword123!';
    await createUserWithSecondFactors({ app, services, email, password });
    const sessionCookie = await createPending2FACookie({
      app,
      email,
      password,
    });

    const client = testClient(app);
    const res = await client.api.auth['2fa'].methods.$get(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    const body = await assertJsonBody(res);

    expect(body.methods).toEqual(['totp', 'passkey']);
  });
});

describe('GET /api/auth/2fa/methods - TOTP disabled', () => {
  let app: AppType;
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      auth: {
        password: {
          enabled: true,
          two_factor: {
            enrollment_required: true,
          },
          totp: {
            enabled: false,
          },
        },
        passkey: {
          enabled: true,
        },
      },
    });
    app = server.app;
    services = server.services;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('filters out registered methods that are disabled in config', async () => {
    const email = generateUniqueEmail('2fa-methods-disabled');
    const password = 'testPassword123!';
    await createUserWithSecondFactors({ app, services, email, password });
    const sessionCookie = await createPending2FACookie({
      app,
      email,
      password,
    });

    const client = testClient(app);
    const res = await client.api.auth['2fa'].methods.$get(
      {},
      { headers: { Cookie: `session=${sessionCookie}` } },
    );
    const body = await assertJsonBody(res);

    expect(body.methods).toEqual(['passkey']);
  });
});
