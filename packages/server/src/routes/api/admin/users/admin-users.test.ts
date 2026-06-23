import { describe, expect, test } from 'vitest';
import type { AppType } from '../../../../entrypoints/app.ts';
import type { ServiceContainer } from '../../../../services/container.ts';
import {
  assertJsonBody,
  createTestApp,
  extractCookie,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_USER,
  TEST_USER_CONFIG,
  withMikroContext,
} from '../../../../test-utils/index.ts';

async function loginAdmin(app: AppType): Promise<string> {
  const res = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: TEST_USER.email,
      password: TEST_USER.password,
    }),
  });
  expect(res.status).toBe(200);
  return extractCookie(res, 'session');
}

async function loginUser(
  app: AppType,
  params: { email: string; password: string },
): Promise<string> {
  const res = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params),
  });
  expect(res.status).toBe(200);
  return extractCookie(res, 'session');
}

async function createDatabaseUser(
  services: ServiceContainer,
  params: {
    email?: string;
    password?: string;
    role?: 'user' | 'admin';
    emailVerified?: boolean;
  } = {},
): Promise<{ sub: string; email: string; password: string }> {
  const email = params.email ?? generateUniqueEmail('admin-managed-user');
  const password = params.password ?? 'Password123!';
  let sub = '';

  await withMikroContext(services, async () => {
    const user = await services.passwordAuthService.createDatabaseUser({
      email,
      password,
    });
    user.role = params.role ?? 'user';
    user.email_verified = params.emailVerified ?? false;
    await services.mikro.em.flush();
    sub = user.sub;
  });

  return { sub, email, password };
}

async function createAdminTestApp() {
  return createTestApp({
    ...MINIMAL_TEST_CONFIG,
    admin: { enabled: true },
    users: [TEST_USER_CONFIG],
  });
}

describe('admin user management API', () => {
  test('lists users with search and pagination metadata', async () => {
    const server = await createAdminTestApp();
    try {
      const session = await loginAdmin(server.app);
      const dbUser = await createDatabaseUser(server.services, {
        email: generateUniqueEmail('listed-user'),
        emailVerified: true,
      });

      const res = await server.app.request(
        `/api/admin/users?query=${encodeURIComponent(dbUser.email)}&page=1&page_size=10`,
        { headers: { Cookie: `session=${session}` } },
      );

      expect(res.status).toBe(200);
      const body = await assertJsonBody(res);
      expect(body.pagination).toMatchObject({
        page: 1,
        page_size: 10,
        total: 1,
      });
      expect(body.users).toHaveLength(1);
      expect(body.users[0]).toMatchObject({
        sub: dbUser.sub,
        email: dbUser.email,
        role: 'user',
        managed_by: 'database',
        email_verified: true,
        has_password: true,
        deleted_at: null,
      });
    } finally {
      await server.cleanup();
    }
  });

  test('filters users by source and role on the server', async () => {
    const server = await createAdminTestApp();
    try {
      const session = await loginAdmin(server.app);
      const dbAdmin = await createDatabaseUser(server.services, {
        role: 'admin',
        emailVerified: true,
      });

      const dbRes = await server.app.request(
        '/api/admin/users?managed_by=database',
        {
          headers: { Cookie: `session=${session}` },
        },
      );
      expect(dbRes.status).toBe(200);
      const dbBody = await assertJsonBody(dbRes);
      expect(dbBody.users.map((user: { sub: string }) => user.sub)).toContain(
        dbAdmin.sub,
      );
      expect(
        dbBody.users.every(
          (user: { managed_by: string }) => user.managed_by === 'database',
        ),
      ).toBe(true);

      const adminRes = await server.app.request('/api/admin/users?role=admin', {
        headers: { Cookie: `session=${session}` },
      });
      expect(adminRes.status).toBe(200);
      const adminBody = await assertJsonBody(adminRes);
      expect(
        adminBody.users.map((user: { sub: string }) => user.sub),
      ).toContain(dbAdmin.sub);
      expect(
        adminBody.users.every(
          (user: { role: string }) => user.role === 'admin',
        ),
      ).toBe(true);
    } finally {
      await server.cleanup();
    }
  });

  test('creates a database-managed user that can log in', async () => {
    const server = await createAdminTestApp();
    try {
      const session = await loginAdmin(server.app);
      const email = generateUniqueEmail('created-admin-user');

      const createRes = await server.app.request('/api/admin/users', {
        method: 'POST',
        headers: {
          Cookie: `session=${session}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password: 'created-password',
          role: 'admin',
          email_verified: true,
        }),
      });

      expect(createRes.status).toBe(201);
      const body = await assertJsonBody(createRes, 201);
      expect(body.user).toMatchObject({
        email,
        role: 'admin',
        managed_by: 'database',
        email_verified: true,
        has_password: true,
      });

      const loginRes = await server.app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: 'created-password' }),
      });
      expect(loginRes.status).toBe(200);
    } finally {
      await server.cleanup();
    }
  });

  test('rejects duplicate user email on create', async () => {
    const server = await createAdminTestApp();
    try {
      const session = await loginAdmin(server.app);

      const res = await server.app.request('/api/admin/users', {
        method: 'POST',
        headers: {
          Cookie: `session=${session}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          email: TEST_USER.email,
          password: 'Password123!',
        }),
      });

      expect(res.status).toBe(409);
      const body = await assertJsonBody(res, 409);
      expect(body.code).toBe('EMAIL_ALREADY_EXISTS');
    } finally {
      await server.cleanup();
    }
  });

  test('updates database-managed users', async () => {
    const server = await createAdminTestApp();
    try {
      const session = await loginAdmin(server.app);
      const dbUser = await createDatabaseUser(server.services);
      const newEmail = generateUniqueEmail('updated-admin-user');

      const res = await server.app.request(`/api/admin/users/${dbUser.sub}`, {
        method: 'PATCH',
        headers: {
          Cookie: `session=${session}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          email: newEmail,
          role: 'admin',
          email_verified: true,
        }),
      });

      expect(res.status).toBe(200);
      const body = await assertJsonBody(res);
      expect(body.user).toMatchObject({
        sub: dbUser.sub,
        email: newEmail,
        role: 'admin',
        email_verified: true,
      });
    } finally {
      await server.cleanup();
    }
  });

  test('keeps config-managed users read-only', async () => {
    const server = await createAdminTestApp();
    try {
      const session = await loginAdmin(server.app);

      const res = await server.app.request(
        `/api/admin/users/${TEST_USER_CONFIG.sub}`,
        {
          method: 'PATCH',
          headers: {
            Cookie: `session=${session}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ email_verified: true }),
        },
      );

      expect(res.status).toBe(403);
      const body = await assertJsonBody(res, 403);
      expect(body.code).toBe('USER_NOT_EDITABLE');
    } finally {
      await server.cleanup();
    }
  });

  test('prevents an admin from demoting or deleting themselves', async () => {
    const server = await createAdminTestApp();
    try {
      const session = await loginAdmin(server.app);

      const demoteRes = await server.app.request(
        `/api/admin/users/${TEST_USER_CONFIG.sub}`,
        {
          method: 'PATCH',
          headers: {
            Cookie: `session=${session}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ role: 'user' }),
        },
      );
      expect(demoteRes.status).toBe(403);

      const deleteRes = await server.app.request(
        `/api/admin/users/${TEST_USER_CONFIG.sub}`,
        {
          method: 'DELETE',
          headers: { Cookie: `session=${session}` },
        },
      );
      expect(deleteRes.status).toBe(403);
    } finally {
      await server.cleanup();
    }
  });

  test('soft deletes database-managed users', async () => {
    const server = await createAdminTestApp();
    try {
      const session = await loginAdmin(server.app);
      const dbUser = await createDatabaseUser(server.services);

      const res = await server.app.request(`/api/admin/users/${dbUser.sub}`, {
        method: 'DELETE',
        headers: { Cookie: `session=${session}` },
      });

      expect(res.status).toBe(200);
      const body = await assertJsonBody(res);
      expect(body.user.sub).toBe(dbUser.sub);
      expect(body.user.deleted_at).toEqual(expect.any(String));

      const loginRes = await server.app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: dbUser.email,
          password: dbUser.password,
        }),
      });
      expect(loginRes.status).toBe(401);
    } finally {
      await server.cleanup();
    }
  });

  test('parses include_deleted only from strict true and false strings', async () => {
    const server = await createAdminTestApp();
    try {
      const session = await loginAdmin(server.app);
      const dbUser = await createDatabaseUser(server.services);
      await server.app.request(`/api/admin/users/${dbUser.sub}`, {
        method: 'DELETE',
        headers: { Cookie: `session=${session}` },
      });

      const withoutDeletedRes = await server.app.request(
        `/api/admin/users?query=${encodeURIComponent(dbUser.email)}&include_deleted=false`,
        { headers: { Cookie: `session=${session}` } },
      );
      expect(withoutDeletedRes.status).toBe(200);
      const withoutDeletedBody = await assertJsonBody(withoutDeletedRes);
      expect(withoutDeletedBody.users).toHaveLength(0);
      expect(withoutDeletedBody.pagination.total).toBe(0);

      const withDeletedRes = await server.app.request(
        `/api/admin/users?query=${encodeURIComponent(dbUser.email)}&include_deleted=true`,
        { headers: { Cookie: `session=${session}` } },
      );
      expect(withDeletedRes.status).toBe(200);
      const withDeletedBody = await assertJsonBody(withDeletedRes);
      expect(withDeletedBody.users).toHaveLength(1);
      expect(withDeletedBody.users[0]).toMatchObject({
        sub: dbUser.sub,
        deleted_at: expect.any(String),
      });
    } finally {
      await server.cleanup();
    }
  });

  test.each([
    '',
    '1',
    '0',
    'yes',
    'False',
  ])('rejects invalid include_deleted=%s values', async (includeDeleted) => {
    const server = await createAdminTestApp();
    try {
      const session = await loginAdmin(server.app);
      const res = await server.app.request(
        `/api/admin/users?include_deleted=${encodeURIComponent(includeDeleted)}`,
        { headers: { Cookie: `session=${session}` } },
      );

      expect(res.status).toBe(400);
    } finally {
      await server.cleanup();
    }
  });

  test('invalidates existing sessions for soft-deleted users', async () => {
    const server = await createAdminTestApp();
    try {
      const adminSession = await loginAdmin(server.app);
      const dbAdmin = await createDatabaseUser(server.services, {
        role: 'admin',
        emailVerified: true,
      });
      const deletedAdminSession = await loginUser(server.app, {
        email: dbAdmin.email,
        password: dbAdmin.password,
      });

      const deleteRes = await server.app.request(
        `/api/admin/users/${dbAdmin.sub}`,
        {
          method: 'DELETE',
          headers: { Cookie: `session=${adminSession}` },
        },
      );
      expect(deleteRes.status).toBe(200);

      const userSessionRes = await server.app.request('/api/user/session', {
        headers: { Cookie: `session=${deletedAdminSession}` },
      });
      expect(userSessionRes.status).toBe(200);
      expect((await assertJsonBody(userSessionRes)).user).toBeNull();

      const adminMeRes = await server.app.request('/api/admin/me', {
        headers: { Cookie: `session=${deletedAdminSession}` },
      });
      expect(adminMeRes.status).toBe(401);
    } finally {
      await server.cleanup();
    }
  });

  test('returns 409 instead of leaking unique constraint errors for deleted emails', async () => {
    const server = await createAdminTestApp();
    try {
      const session = await loginAdmin(server.app);
      const deletedUser = await createDatabaseUser(server.services);
      const activeUser = await createDatabaseUser(server.services);
      await server.app.request(`/api/admin/users/${deletedUser.sub}`, {
        method: 'DELETE',
        headers: { Cookie: `session=${session}` },
      });

      const recreateRes = await server.app.request('/api/admin/users', {
        method: 'POST',
        headers: {
          Cookie: `session=${session}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          email: deletedUser.email,
          password: 'Password123!',
        }),
      });
      expect(recreateRes.status).toBe(409);
      expect((await assertJsonBody(recreateRes, 409)).code).toBe(
        'EMAIL_ALREADY_EXISTS',
      );

      const updateRes = await server.app.request(
        `/api/admin/users/${activeUser.sub}`,
        {
          method: 'PATCH',
          headers: {
            Cookie: `session=${session}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ email: deletedUser.email }),
        },
      );
      expect(updateRes.status).toBe(409);
      expect((await assertJsonBody(updateRes, 409)).code).toBe(
        'EMAIL_ALREADY_EXISTS',
      );
    } finally {
      await server.cleanup();
    }
  });

  test('prevents database-managed admins from demoting or deleting themselves', async () => {
    const server = await createAdminTestApp();
    try {
      const dbAdmin = await createDatabaseUser(server.services, {
        role: 'admin',
        emailVerified: true,
      });
      const session = await loginUser(server.app, {
        email: dbAdmin.email,
        password: dbAdmin.password,
      });

      const demoteRes = await server.app.request(
        `/api/admin/users/${dbAdmin.sub}`,
        {
          method: 'PATCH',
          headers: {
            Cookie: `session=${session}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ role: 'user' }),
        },
      );
      expect(demoteRes.status).toBe(403);

      const deleteRes = await server.app.request(
        `/api/admin/users/${dbAdmin.sub}`,
        {
          method: 'DELETE',
          headers: { Cookie: `session=${session}` },
        },
      );
      expect(deleteRes.status).toBe(403);
    } finally {
      await server.cleanup();
    }
  });
});
