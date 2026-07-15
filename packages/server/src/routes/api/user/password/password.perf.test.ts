import { testClient } from 'hono/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

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
import {
  deferPerfResponseValidation,
  perfFixture,
  runHttpPerf,
} from '../../../../test-utils/perf/index.js';

const WARMUP_REQUESTS = 4;
const MEASURED_REQUESTS = 20;

let app: AppType;
let client: ReturnType<typeof testClient<AppType>>;
let services: ServiceContainer;
let cleanup: () => Promise<void>;

beforeEach(async () => {
  const server = await createTestApp(MINIMAL_TEST_CONFIG);
  app = server.app;
  client = testClient(app);
  services = server.services;
  cleanup = server.cleanup;
});

afterEach(async () => {
  await cleanup();
});

async function createOAuthOnlySession(index: number) {
  const email = generateUniqueEmail(`password-post-perf-${index}`);
  const temporaryPassword = 'Temporary123!';

  await withMikroContext(services, async () => {
    const passwordHash =
      await services.securityService.hashPassword(temporaryPassword);
    const user = services.mikro.user.create({
      email,
      password_hash: passwordHash,
    });
    user.email_verified = true;
    await services.mikro.em.persist(user).flush();
  });

  const loginResponse = await client.api.auth.login.$post({
    json: { email, password: temporaryPassword },
  });
  expect(loginResponse.status).toBe(200);

  await withMikroContext(services, async () => {
    const user = await services.mikro.user.findOneOrFail({ email });
    user.password_hash = null;
    await services.mikro.em.flush();
  });

  return extractCookie(loginResponse, 'session');
}

async function createPasswordDeleteFixture(index: number) {
  const password = 'CurrentPassword123!';
  const { sessionCookie, userSub } = await createDbUserWithSession(
    app,
    services,
    generateUniqueEmail(`password-delete-perf-${index}`),
    password,
  );

  await withMikroContext(services, async () => {
    await services.mikro.userOAuth.linkAccount({
      userSub,
      providerName: 'google',
      providerUserId: `google-password-delete-${crypto.randomUUID()}`,
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresAt: null,
    });
  });

  return { sessionCookie, password };
}

async function requestSetPassword(sessionCookie: string) {
  const response = await client.api.user.password.$post(
    {
      json: { password: 'NewPassword123!' },
    },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });
}

async function requestChangePassword(
  sessionCookie: string,
  currentPassword: string,
) {
  const response = await client.api.user.password.$put(
    {
      json: {
        current_password: currentPassword,
        new_password: 'ChangedPassword123!',
      },
    },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });
}

async function requestDeletePassword(
  sessionCookie: string,
  currentPassword: string,
) {
  const response = await client.api.user.password.$delete(
    {
      json: { current_password: currentPassword },
    },
    { headers: { Cookie: `session=${sessionCookie}` } },
  );
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });
}

describe('POST /api/user/password perf', () => {
  test('handles pre-created OAuth-only password setup sessions through the real route', async () => {
    const sessionCookies = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, (_, index) =>
        createOAuthOnlySession(index),
      ),
    );
    await runHttpPerf({
      name: 'POST /api/user/password smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      request: async (context) => {
        const sessionCookie = perfFixture(
          sessionCookies,
          context,
          WARMUP_REQUESTS,
        );
        return requestSetPassword(sessionCookie);
      },
    });
  });
});

describe('PUT /api/user/password perf', () => {
  test('handles pre-created password-change sessions through the real route', async () => {
    const fixtures = await Promise.all(
      Array.from(
        { length: WARMUP_REQUESTS + MEASURED_REQUESTS },
        (_, index) => {
          const password = 'CurrentPassword123!';
          return createDbUserWithSession(
            app,
            services,
            generateUniqueEmail(`password-put-perf-${index}`),
            password,
          ).then((fixture) => ({ ...fixture, password }));
        },
      ),
    );
    await runHttpPerf({
      name: 'PUT /api/user/password smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      request: async (context) => {
        const fixture = perfFixture(fixtures, context, WARMUP_REQUESTS);
        return requestChangePassword(fixture.sessionCookie, fixture.password);
      },
    });
  });
});

describe('DELETE /api/user/password perf', () => {
  test('handles pre-created password-delete sessions through the real route', async () => {
    const fixtures = await Promise.all(
      Array.from({ length: WARMUP_REQUESTS + MEASURED_REQUESTS }, (_, index) =>
        createPasswordDeleteFixture(index),
      ),
    );
    await runHttpPerf({
      name: 'DELETE /api/user/password smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: 2,
      request: async (context) => {
        const fixture = perfFixture(fixtures, context, WARMUP_REQUESTS);
        return requestDeletePassword(fixture.sessionCookie, fixture.password);
      },
    });
  });
});
