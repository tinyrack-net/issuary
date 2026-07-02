import { afterAll, beforeAll, describe, expect, test } from 'vitest';

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
import { runHttpPerf } from '../../../../test-utils/perf/index.js';

const WARMUP_REQUESTS = 3;
const MEASURED_REQUESTS = 20;
const CONCURRENCY = 4;
const TOTAL_REQUESTS = WARMUP_REQUESTS + MEASURED_REQUESTS;

let app: AppType;
let services: ServiceContainer;
let adminSession = '';
let cleanup: () => Promise<void> = async () => {};
let emailCounter = 0;

beforeAll(async () => {
  const server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    admin: { enabled: true },
    users: [TEST_USER_CONFIG],
  });
  app = server.app;
  services = server.services;
  cleanup = server.cleanup;

  adminSession = await loginAdmin();
});

afterAll(async () => {
  await cleanup();
});

async function loginAdmin(): Promise<string> {
  const response = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: TEST_USER.email,
      password: TEST_USER.password,
    }),
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

function uniqueEmail(prefix: string): string {
  emailCounter += 1;
  return `${prefix}-${Date.now()}-${emailCounter}-${crypto.randomUUID()}@example.com`;
}

function nextItem<T>(items: T[]): T {
  const item = items.shift();
  if (item === undefined) {
    throw new Error('Missing pre-created perf fixture');
  }
  return item;
}

async function requestAdminMe() {
  const response = await app.request('/api/admin/me', {
    headers: { Cookie: `session=${adminSession}` },
  });
  const body = await assertJsonBody(response);

  expect(response.status).toBe(200);
  expect(body.user).toMatchObject({
    sub: TEST_USER_CONFIG.sub,
    email: TEST_USER.email,
    role: 'admin',
  });

  return response;
}

async function requestAdminUsers(query = 'page=1&page_size=10') {
  const response = await app.request(`/api/admin/users?${query}`, {
    headers: { Cookie: `session=${adminSession}` },
  });
  const body = await assertJsonBody(response);

  expect(response.status).toBe(200);
  expect(Array.isArray(body.users)).toBe(true);
  expect(body.pagination).toMatchObject({ page: 1 });

  return response;
}

async function requestCreateAdminUser(email: string) {
  const response = await app.request('/api/admin/users', {
    method: 'POST',
    headers: {
      Cookie: `session=${adminSession}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password: 'Password123!',
      role: 'user',
      email_verified: true,
    }),
  });
  const body = await assertJsonBody(response, 201);

  expect(response.status).toBe(201);
  expect(body.user).toMatchObject({
    email,
    role: 'user',
    managed_by: 'database',
    email_verified: true,
  });

  return response;
}

async function requestGetAdminUser(sub: string, email: string) {
  const response = await app.request(`/api/admin/users/${sub}`, {
    headers: { Cookie: `session=${adminSession}` },
  });
  const body = await assertJsonBody(response);

  expect(response.status).toBe(200);
  expect(body.user).toMatchObject({ sub, email, managed_by: 'database' });

  return response;
}

async function requestPatchAdminUser(sub: string, email: string) {
  const response = await app.request(`/api/admin/users/${sub}`, {
    method: 'PATCH',
    headers: {
      Cookie: `session=${adminSession}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email, role: 'admin', email_verified: true }),
  });
  const body = await assertJsonBody(response);

  expect(response.status).toBe(200);
  expect(body.user).toMatchObject({
    sub,
    email,
    role: 'admin',
    email_verified: true,
  });

  return response;
}

async function requestDeleteAdminUser(sub: string) {
  const response = await app.request(`/api/admin/users/${sub}`, {
    method: 'DELETE',
    headers: { Cookie: `session=${adminSession}` },
  });
  const body = await assertJsonBody(response);

  expect(response.status).toBe(200);
  expect(body.user).toMatchObject({ sub, deleted_at: expect.any(String) });

  return response;
}

describe('admin user management API perf', () => {
  test('GET /api/admin/me handles repeated authenticated admin identity requests', async () => {
    const result = await runHttpPerf({
      name: 'GET /api/admin/me authenticated smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: CONCURRENCY,
      request: requestAdminMe,
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(2);
    expect(result.p95Ms).toBeLessThan(1500);
  });

  test('GET /api/admin/users handles repeated list requests through the real route', async () => {
    await Promise.all(
      Array.from({ length: 5 }, () => createDatabaseUser('admin-list-perf')),
    );

    const result = await runHttpPerf({
      name: 'GET /api/admin/users authenticated smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: CONCURRENCY,
      request: async () => requestAdminUsers(),
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(2);
    expect(result.p95Ms).toBeLessThan(1500);
  });

  test('GET /api/admin/users does not grow pathologically with a larger page', async () => {
    const smallResult = await runHttpPerf({
      name: 'GET /api/admin/users small page',
      warmupRequests: 2,
      requests: 12,
      concurrency: 3,
      request: async () => requestAdminUsers('page=1&page_size=5'),
    });

    await Promise.all(
      Array.from({ length: 25 }, () => createDatabaseUser('admin-scale-perf')),
    );

    const largeResult = await runHttpPerf({
      name: 'GET /api/admin/users larger page',
      warmupRequests: 2,
      requests: 12,
      concurrency: 3,
      request: async () => requestAdminUsers('page=1&page_size=30'),
    });

    expect(smallResult.failed).toBe(0);
    expect(largeResult.failed).toBe(0);
    expect(smallResult.statusCounts[200]).toBe(12);
    expect(largeResult.statusCounts[200]).toBe(12);
    expect(largeResult.rps).toBeGreaterThan(1);
    expect(largeResult.p95Ms).toBeLessThan(2000);
    expect(largeResult.p95Ms).toBeLessThan(smallResult.p95Ms * 5 + 100);
  });

  test('POST /api/admin/users handles pre-generated create requests', async () => {
    const emails = Array.from({ length: TOTAL_REQUESTS }, () =>
      uniqueEmail('admin-create-perf'),
    );

    const result = await runHttpPerf({
      name: 'POST /api/admin/users create smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: CONCURRENCY,
      expectedStatuses: [201],
      request: async () => requestCreateAdminUser(nextItem(emails)),
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[201]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(1);
    expect(result.p95Ms).toBeLessThan(2000);
  });

  test('GET /api/admin/users/:sub handles repeated user detail requests', async () => {
    const user = await createDatabaseUser('admin-get-user-perf');

    const result = await runHttpPerf({
      name: 'GET /api/admin/users/:sub detail smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: CONCURRENCY,
      request: async () => requestGetAdminUser(user.sub, user.email),
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(2);
    expect(result.p95Ms).toBeLessThan(1500);
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

    const result = await runHttpPerf({
      name: 'PATCH /api/admin/users/:sub update smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: CONCURRENCY,
      request: async () => {
        const target = nextItem(targets);
        return requestPatchAdminUser(target.sub, target.email);
      },
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(1);
    expect(result.p95Ms).toBeLessThan(2000);
  });

  test('DELETE /api/admin/users/:sub handles pre-created delete targets', async () => {
    const targets = await Promise.all(
      Array.from({ length: TOTAL_REQUESTS }, () =>
        createDatabaseUser('admin-delete-perf'),
      ),
    );

    const result = await runHttpPerf({
      name: 'DELETE /api/admin/users/:sub delete smoke',
      warmupRequests: WARMUP_REQUESTS,
      requests: MEASURED_REQUESTS,
      concurrency: CONCURRENCY,
      request: async () => requestDeleteAdminUser(nextItem(targets).sub),
    });

    expect(result.totalRequests).toBe(MEASURED_REQUESTS);
    expect(result.failed).toBe(0);
    expect(result.statusCounts[200]).toBe(MEASURED_REQUESTS);
    expect(result.errorRate).toBe(0);
    expect(result.rps).toBeGreaterThan(1);
    expect(result.p95Ms).toBeLessThan(2000);
  });
});
