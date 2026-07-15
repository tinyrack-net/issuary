import { testClient } from 'hono/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import type { AppType } from '../../../../entrypoints/app.js';
import type { ServiceContainer } from '../../../../services/container.js';
import {
  assertJsonBody,
  createAuthenticatedSession,
  createDbUserWithSession,
  createPasskeyForUser,
  createTestApp,
  enableTotpForUser,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_USER_CONFIG,
} from '../../../../test-utils/index.js';
import {
  deferPerfResponseValidation,
  runHttpPerf,
} from '../../../../test-utils/perf/index.js';

let app: AppType;
let client: ReturnType<typeof testClient<AppType>>;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [TEST_USER_CONFIG],
  });
  app = server.app;
  client = testClient(app);
  services = server.services;
  cleanup = server.cleanup;
});

afterEach(async () => {
  await cleanup();
});

describe('GET /api/user/session perf', () => {
  test('smoke handles unauthenticated session requests through the real route', async () => {
    await runHttpPerf({
      name: 'GET /api/user/session smoke',
      warmupRequests: 10,
      requests: 100,
      concurrency: 5,
      request: async () => {
        const response = await client.api.user.session.$get();
        return deferPerfResponseValidation(response, async () => {
          const body = await assertJsonBody(response);
          expect(body.user).toBeNull();
        });
      },
    });
  });

  test('smoke handles authenticated session-cookie requests through the real route', async () => {
    const sessionCookie = await createAuthenticatedSession(app);

    await runHttpPerf({
      name: 'GET /api/user/session authenticated smoke',
      warmupRequests: 5,
      requests: 50,
      concurrency: 5,
      request: async () => {
        const response = await client.api.user.session.$get(
          {},
          { headers: { Cookie: `session=${sessionCookie}` } },
        );
        return deferPerfResponseValidation(response, async () => {
          const body = await assertJsonBody(response);
          expect(body).toEqual({
            user: expect.objectContaining({
              sub: expect.any(String),
            }),
          });
        });
      },
    });
  });

  test('smoke handles database users with registered second factors through the real route', async () => {
    const password = 'Password123!';
    const { sessionCookie, userSub } = await createDbUserWithSession(
      app,
      services,
      generateUniqueEmail('session-db-2fa-perf'),
      password,
    );
    await enableTotpForUser(services, userSub);
    await createPasskeyForUser(services, userSub, 'Session Perf Passkey');

    await runHttpPerf({
      name: 'GET /api/user/session database 2FA user smoke',
      warmupRequests: 5,
      requests: 50,
      concurrency: 5,
      request: async () => {
        const response = await client.api.user.session.$get(
          {},
          { headers: { Cookie: `session=${sessionCookie}` } },
        );
        return deferPerfResponseValidation(response, async () => {
          const body = await assertJsonBody(response);
          expect(body).toEqual({
            user: expect.objectContaining({
              sub: userSub,
              managed_by: 'database',
              totp_registered: true,
              passkey_count: 1,
            }),
          });
        });
      },
    });
  });
});
