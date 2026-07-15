import { testClient } from 'hono/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import type { AppType } from '../../../../entrypoints/app.js';
import type { ServiceContainer } from '../../../../services/container.js';
import {
  assertJsonBody,
  createTestApp,
  extractCookie,
  MINIMAL_TEST_CONFIG,
  TEST_USER,
  TEST_USER_CONFIG,
  withMikroContext,
} from '../../../../test-utils/index.js';
import {
  deferPerfResponseValidation,
  perfFixture,
  runHttpPerf,
} from '../../../../test-utils/perf/index.js';

const WARMUP_REQUESTS = 10;
const MEASURED_REQUESTS = 50;
const CONCURRENCY = 4;
const TOTAL_REQUESTS = WARMUP_REQUESTS + MEASURED_REQUESTS;
const ADMIN_SCALE_USER_COUNT = 1_000;

type AdminUsersQueryInput = {
  query?: string;
  page?: string;
  page_size?: string;
  include_deleted?: 'true' | 'false';
  managed_by?: 'database' | 'config';
  role?: 'user' | 'admin';
};

let app: AppType;
let client: ReturnType<typeof testClient<AppType>>;
let services: ServiceContainer;
let adminSession = '';
let cleanup: () => Promise<void> = async () => {};
let emailCounter = 0;
let scaleUsersSeeded = false;

async function setupPerfApp(): Promise<void> {
  emailCounter = 0;
  scaleUsersSeeded = false;
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    admin: { enabled: true },
    users: [TEST_USER_CONFIG],
  });
  app = server.app;
  client = testClient(app);
  services = server.services;
  cleanup = server.cleanup;

  adminSession = await loginAdmin();
}

async function resetPerfApp(): Promise<void> {
  await cleanup();
  cleanup = async () => {};
  await setupPerfApp();
}

beforeEach(async () => {
  await setupPerfApp();
});

afterEach(async () => {
  await cleanup();
});

async function loginAdmin(): Promise<string> {
  const response = await client.api.auth.login.$post({
    json: {
      email: TEST_USER.email,
      password: TEST_USER.password,
    },
  });

  expect(response.status).toBe(200);
  return extractCookie(response, 'session');
}

async function createDatabaseUser(
  prefix: string,
): Promise<{ sub: string; email: string }> {
  const email = uniqueEmail(prefix);
  let sub = '';

  await withMikroContext(services, async () => {
    const user = await services.passwordAuthService.createDatabaseUser({
      email,
      password: 'Password123!',
    });
    user.email_verified = true;
    await services.mikro.em.flush();
    sub = user.sub;
  });

  return { sub, email };
}

async function seedAdminListScaleUsers(): Promise<void> {
  if (scaleUsersSeeded) {
    return;
  }

  await withMikroContext(services, async () => {
    for (let index = 0; index < ADMIN_SCALE_USER_COUNT; index += 1) {
      const paddedIndex = String(index).padStart(4, '0');
      const user = services.mikro.user.create({
        email: `admin-scale-${paddedIndex}-${crypto.randomUUID()}@example.com`,
        email_verified: index % 3 !== 0,
        managed_by: 'database',
        role: index % 10 === 0 ? 'admin' : 'user',
        deleted_at: index % 25 === 0 ? new Date() : null,
      });
      services.mikro.em.persist(user);
    }

    await services.mikro.em.flush();
  });

  scaleUsersSeeded = true;
}

function uniqueEmail(prefix: string): string {
  emailCounter += 1;
  return `${prefix}-${Date.now()}-${emailCounter}-${crypto.randomUUID()}@example.com`;
}

async function requestAdminMe() {
  const response = await client.api.admin.me.$get(
    {},
    { headers: { Cookie: `session=${adminSession}` } },
  );
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(response.status).toBe(200);
    expect(body.user).toMatchObject({
      sub: TEST_USER_CONFIG.sub,
      email: TEST_USER.email,
      role: 'admin',
    });
  });
}

async function requestAdminUsers(
  query: AdminUsersQueryInput = { page: '1', page_size: '10' },
) {
  const response = await client.api.admin.users.$get(
    { query },
    { headers: { Cookie: `session=${adminSession}` } },
  );
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(response.status).toBe(200);
    expect(Array.isArray(body.users)).toBe(true);
    const page = Number(query.page ?? '1');
    expect(body.pagination).toMatchObject({ page });
  });
}

async function requestCreateAdminUser(email: string) {
  const response = await client.api.admin.users.$post(
    {
      json: {
        email,
        password: 'Password123!',
        role: 'user',
        email_verified: true,
      },
    },
    { headers: { Cookie: `session=${adminSession}` } },
  );
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response, 201);
    expect(response.status).toBe(201);
    expect(body.user).toMatchObject({
      email,
      role: 'user',
      managed_by: 'database',
      email_verified: true,
    });
  });
}

async function requestGetAdminUser(sub: string, email: string) {
  const response = await client.api.admin.users[':sub'].$get(
    { param: { sub } },
    { headers: { Cookie: `session=${adminSession}` } },
  );
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(response.status).toBe(200);
    expect(body.user).toMatchObject({ sub, email, managed_by: 'database' });
  });
}

async function requestPatchAdminUser(sub: string, email: string) {
  const response = await client.api.admin.users[':sub'].$patch(
    {
      param: { sub },
      json: { email, role: 'admin', email_verified: true },
    },
    { headers: { Cookie: `session=${adminSession}` } },
  );
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(response.status).toBe(200);
    expect(body.user).toMatchObject({
      sub,
      email,
      role: 'admin',
      email_verified: true,
    });
  });
}

async function requestDeleteAdminUser(sub: string) {
  const response = await client.api.admin.users[':sub'].$delete(
    { param: { sub } },
    { headers: { Cookie: `session=${adminSession}` } },
  );
  return deferPerfResponseValidation(response, async () => {
    const body = await assertJsonBody(response);
    expect(response.status).toBe(200);
    expect(body.user).toMatchObject({ sub, deleted_at: expect.any(String) });
  });
}

describe('admin user management API perf', () => {
  test('GET /api/admin/me handles repeated authenticated admin identity requests', async () => {
    await runHttpPerf({
      name: 'GET /api/admin/me authenticated smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: CONCURRENCY,
      request: requestAdminMe,
    });
  });

  test('GET /api/admin/users handles repeated list requests through the real route', async () => {
    await Promise.all(
      Array.from({ length: 5 }, () => createDatabaseUser('admin-list-perf')),
    );

    await runHttpPerf({
      name: 'GET /api/admin/users authenticated smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: CONCURRENCY,
      request: async () => requestAdminUsers(),
    });
  });

  test('GET /api/admin/users does not grow pathologically with a larger page', async () => {
    const smallResult = await runHttpPerf({
      name: 'GET /api/admin/users small page',
      warmupRequests: 2,
      requests: 12,
      concurrency: 3,
      request: async () => requestAdminUsers({ page: '1', page_size: '5' }),
    });

    await resetPerfApp();
    await Promise.all(
      Array.from({ length: 25 }, () => createDatabaseUser('admin-scale-perf')),
    );

    const largeResult = await runHttpPerf({
      name: 'GET /api/admin/users larger page',
      warmupRequests: 2,
      requests: 12,
      concurrency: 3,
      request: async () => requestAdminUsers({ page: '1', page_size: '30' }),
    });

    expect(largeResult.p95Ms).toBeLessThan(smallResult.p95Ms * 5 + 100);
  });

  test('GET /api/admin/users handles larger user tables, deep pages, and filters', async () => {
    await seedAdminListScaleUsers();
    const queries: AdminUsersQueryInput[] = [
      { page: '1', page_size: '100' },
      { page: '10', page_size: '100' },
      { page: '1', page_size: '100', query: 'admin-scale-09' },
      { page: '1', page_size: '100', role: 'admin' },
      { page: '1', page_size: '100', include_deleted: 'true' },
      { page: '1', page_size: '100', managed_by: 'database' },
    ];
    await runHttpPerf({
      name: 'GET /api/admin/users larger table filters',
      warmupRequests: 3,
      requests: 24,
      concurrency: 4,
      request: async (context) => {
        const query = queries[context.index % queries.length];
        return requestAdminUsers(query);
      },
    });
  });

  test('POST /api/admin/users handles pre-generated create requests', async () => {
    const emails = Array.from({ length: TOTAL_REQUESTS }, () =>
      uniqueEmail('admin-create-perf'),
    );

    await runHttpPerf({
      name: 'POST /api/admin/users create smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: CONCURRENCY,
      expectedStatuses: [201],
      request: async (context) =>
        requestCreateAdminUser(perfFixture(emails, context, WARMUP_REQUESTS)),
    });
  });

  test('GET /api/admin/users/:sub handles repeated user detail requests', async () => {
    const user = await createDatabaseUser('admin-get-user-perf');

    await runHttpPerf({
      name: 'GET /api/admin/users/:sub detail smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: CONCURRENCY,
      request: async () => requestGetAdminUser(user.sub, user.email),
    });
  });

  test('PATCH /api/admin/users/:sub handles pre-created update targets', async () => {
    const targets = await Promise.all(
      Array.from({ length: TOTAL_REQUESTS }, async () => {
        const user = await createDatabaseUser('admin-patch-perf');
        return {
          sub: user.sub,
          email: uniqueEmail('admin-patched-perf'),
        };
      }),
    );

    await runHttpPerf({
      name: 'PATCH /api/admin/users/:sub update smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: CONCURRENCY,
      request: async (context) => {
        const target = perfFixture(targets, context, WARMUP_REQUESTS);
        return requestPatchAdminUser(target.sub, target.email);
      },
    });
  });

  test('DELETE /api/admin/users/:sub handles pre-created delete targets', async () => {
    const targets = await Promise.all(
      Array.from({ length: TOTAL_REQUESTS }, () =>
        createDatabaseUser('admin-delete-perf'),
      ),
    );

    await runHttpPerf({
      name: 'DELETE /api/admin/users/:sub delete smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: CONCURRENCY,
      request: async (context) =>
        requestDeleteAdminUser(
          perfFixture(targets, context, WARMUP_REQUESTS).sub,
        ),
    });
  });
});
