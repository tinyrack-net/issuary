import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { ServiceContainer } from '../services/container.ts';
import {
  createAuthenticatedSession,
  createTestApp,
  createTestOAuthClient,
  MINIMAL_TEST_CONFIG,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_USER,
  TEST_USER_CONFIG,
  withMikroContext,
} from '../test-utils/index.ts';
import { type AppType, createAdminApp } from './app.ts';

async function createDatabaseUser(
  services: ServiceContainer,
  params: {
    email: string;
    password: string;
    role: 'user' | 'admin';
    managedBy?: 'database' | 'config';
    emailVerified?: boolean;
  },
) {
  let userSub = '';

  await withMikroContext(services, async () => {
    const passwordHash = await services.securityService.hashPassword(
      params.password,
    );
    const user = services.mikro.user.create({
      email: params.email,
      password_hash: passwordHash,
    });
    user.role = params.role;
    user.managed_by = params.managedBy ?? 'database';
    user.email_verified = params.emailVerified ?? true;
    await services.mikro.em.persist(user).flush();
    userSub = user.sub;
  });

  return userSub;
}

async function withTestApp(
  config: Parameters<typeof createTestApp>[0],
  run: (app: AppType) => Promise<void>,
) {
  const server = await createTestApp(config);
  try {
    await run(server.app);
  } finally {
    await server.cleanup();
  }
}

describe('createApp', () => {
  let app: AppType;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp(MINIMAL_TEST_CONFIG);
    app = server.app;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('serves backend routes normally', async () => {
    const client = testClient(app);
    const res = await client.api.health.$get();

    expect(res.status).toBe(200);
  });

  test('returns JSON 404 for frontend routes', async () => {
    const res = await app.request('/login');

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Not Found' });
  });
});

describe('createApp with frontend config', () => {
  let app: AppType;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      frontend: () => () => new Response('frontend', { status: 200 }),
    });
    app = server.app;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('delegates non-backend routes to frontend handler', async () => {
    const res = await app.request('/some-page');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('frontend');
  });

  test('delegates unmatched backend routes to frontend handler', async () => {
    for (const path of [
      '/api/missing',
      '/oauth/missing',
      '/.well-known/missing',
    ]) {
      const res = await app.request(path);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('frontend');
    }
  });

  test('still allows matched backend routes to work', async () => {
    const client = testClient(app);
    const res = await client.api.health.$get();
    expect(res.status).toBe(200);
  });
});

describe('createApp CORS policy', () => {
  let app: AppType;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      server: {
        public_origin: 'https://app.example.test',
      },
    });
    app = server.app;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('allows the configured public origin with credentials', async () => {
    const res = await app.request('/api/health', {
      headers: { Origin: 'https://app.example.test' },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'https://app.example.test',
    );
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });

  test('does not allow a different origin', async () => {
    const res = await app.request('/api/health', {
      headers: { Origin: 'https://evil.example.test' },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  test('credentialed CORS never returns wildcard ACAO', async () => {
    const res = await app.request('/api/health', {
      headers: { Origin: 'https://app.example.test' },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).not.toBe('*');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });
});

describe('createApp admin API auth boundary', () => {
  test('does not mount admin API when admin is disabled', async () => {
    await withTestApp(MINIMAL_TEST_CONFIG, async (app) => {
      const res = await app.request('/admin/api/session');

      expect(res.status).toBe(404);
    });
  });

  test('returns 401 for unauthenticated admin API requests', async () => {
    await withTestApp(
      {
        ...MINIMAL_TEST_CONFIG,
        admin: { enabled: true },
      },
      async (app) => {
        const res = await app.request('/admin/api/session');

        expect(res.status).toBe(401);
      },
    );
  });

  test('returns 403 for authenticated non-admin admin API requests', async () => {
    const nonAdminEmail = 'non-admin-config-user@example.com';
    const nonAdminPassword = 'changemelater';

    await withTestApp(
      {
        ...MINIMAL_TEST_CONFIG,
        admin: { enabled: true },
        users: [
          {
            sub: 'non-admin-config-user',
            email: nonAdminEmail,
            password: nonAdminPassword,
            role: 'user',
          },
        ],
      },
      async (app) => {
        const sessionCookie = await createAuthenticatedSession(
          app,
          nonAdminEmail,
          nonAdminPassword,
        );
        const res = await app.request('/admin/api/session', {
          headers: { Cookie: `session=${sessionCookie}` },
        });

        expect(res.status).toBe(403);
      },
    );
  });

  test('returns the current admin session summary for admins', async () => {
    await withTestApp(
      {
        ...MINIMAL_TEST_CONFIG,
        admin: { enabled: true },
        users: [TEST_USER_CONFIG],
      },
      async (app) => {
        const sessionCookie = await createAuthenticatedSession(app);
        const res = await app.request('/admin/api/session', {
          headers: { Cookie: `session=${sessionCookie}` },
        });

        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({
          is_admin: true,
          user: {
            sub: TEST_USER_CONFIG.sub,
            email: TEST_USER.email,
            email_verified: true,
            role: 'admin',
            managed_by: 'config',
          },
        });
      },
    );
  });

  test('rejects a soft-deleted admin user with an existing session', async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      admin: { enabled: true },
      users: [TEST_USER_CONFIG],
    });

    try {
      const sessionCookie = await createAuthenticatedSession(server.app);

      await withMikroContext(server.services, async () => {
        const user = await server.services.mikro.user.findOneOrFail({
          sub: TEST_USER_CONFIG.sub,
        });
        user.deleted_at = new Date();
        await server.services.mikro.em.flush();
      });

      const res = await server.app.request('/admin/api/session', {
        headers: { Cookie: `session=${sessionCookie}` },
      });

      expect(res.status).toBe(401);
    } finally {
      await server.cleanup();
    }
  });
});

describe('createApp same-port admin routes', () => {
  test('mounts the admin API at the same-port admin API prefix', async () => {
    await withTestApp(
      {
        ...MINIMAL_TEST_CONFIG,
        admin: { enabled: true },
        users: [TEST_USER_CONFIG],
      },
      async (app) => {
        const sessionCookie = await createAuthenticatedSession(app);
        const res = await app.request('/admin/api/session', {
          headers: { Cookie: `session=${sessionCookie}` },
        });

        expect(res.status).toBe(200);
      },
    );
  });

  test('CSRF protects unsafe admin API requests carrying a session cookie', async () => {
    await withTestApp(
      {
        ...MINIMAL_TEST_CONFIG,
        admin: { enabled: true },
        server: { public_origin: 'https://app.example.test' },
      },
      async (app) => {
        const res = await app.request('/admin/api/session', {
          method: 'POST',
          headers: {
            Cookie: 'session=encrypted-session',
            Origin: 'https://evil.example.test',
          },
        });

        expect(res.status).toBe(403);
        await expect(res.json()).resolves.toEqual({
          code: 'CSRF_VIOLATION',
          message: 'Request rejected: CSRF validation failed.',
        });
      },
    );
  });

  test('uses the admin public origin for separate-port CSRF checks', async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      admin: {
        enabled: true,
        mode: 'separate-port',
        bind_host: '127.0.0.1',
        listen_port: 4081,
      },
      server: { public_origin: 'https://app.example.test' },
    });

    try {
      const app = createAdminApp({
        config: server.services.config,
        services: server.services,
      });

      const sameAdminOriginRes = await app.request('/admin/api/session', {
        method: 'POST',
        headers: {
          Cookie: 'session=encrypted-session',
          Origin: 'http://127.0.0.1:4081',
        },
      });
      expect(sameAdminOriginRes.status).not.toBe(403);

      const mainOriginRes = await app.request('/admin/api/session', {
        method: 'POST',
        headers: {
          Cookie: 'session=encrypted-session',
          Origin: 'https://app.example.test',
        },
      });
      expect(mainOriginRes.status).toBe(403);
    } finally {
      await server.cleanup();
    }
  });

  test('serves the admin static fallback without shadowing the admin API', async () => {
    await withTestApp(
      {
        ...MINIMAL_TEST_CONFIG,
        admin: {
          enabled: true,
          frontend: () => () => new Response('admin-frontend', { status: 200 }),
        },
        frontend: () => () => new Response('main-frontend', { status: 200 }),
      },
      async (app) => {
        const adminRootRes = await app.request('/admin');
        expect(adminRootRes.status).toBe(200);
        expect(await adminRootRes.text()).toBe('admin-frontend');

        const adminFallbackRes = await app.request('/admin/users');
        expect(adminFallbackRes.status).toBe(200);
        expect(await adminFallbackRes.text()).toBe('admin-frontend');

        const adminApiRes = await app.request('/admin/api/session');
        expect(adminApiRes.status).toBe(401);
        await expect(adminApiRes.json()).resolves.toEqual({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in to perform this action.',
        });
      },
    );
  });

  test('redirects exact admin proxy mount path to a trailing slash', async () => {
    await withTestApp(
      {
        ...MINIMAL_TEST_CONFIG,
        admin: {
          enabled: true,
          frontend_mode: 'proxy',
          frontend: () => () => new Response('admin-frontend', { status: 200 }),
        },
      },
      async (app) => {
        const adminRootRes = await app.request('/admin', {
          redirect: 'manual',
        });
        expect(adminRootRes.status).toBe(302);
        expect(adminRootRes.headers.get('location')).toBe('/admin/');

        const adminSlashRes = await app.request('/admin/');
        expect(adminSlashRes.status).toBe(200);
        expect(await adminSlashRes.text()).toBe('admin-frontend');
      },
    );
  });

  test('leaves existing backend routes and main frontend fallback unaffected', async () => {
    await withTestApp(
      {
        ...MINIMAL_TEST_CONFIG,
        admin: {
          enabled: true,
          frontend: () => () => new Response('admin-frontend', { status: 200 }),
        },
        frontend: () => () => new Response('main-frontend', { status: 200 }),
      },
      async (app) => {
        const healthRes = await app.request('/api/health');
        expect(healthRes.status).toBe(200);

        for (const path of ['/login', '/api/missing', '/oauth/missing']) {
          const res = await app.request(path);
          expect(res.status).toBe(200);
          expect(await res.text()).toBe('main-frontend');
        }
      },
    );
  });
});

describe('createApp admin user management API', () => {
  test('allows admins to list and inspect users without secret fields', async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      admin: { enabled: true },
      users: [TEST_USER_CONFIG],
    });
    try {
      const targetSub = await createDatabaseUser(server.services, {
        email: 'listed-user@example.com',
        password: 'changemelater',
        role: 'user',
        emailVerified: false,
      });
      const sessionCookie = await createAuthenticatedSession(server.app);

      const listRes = await server.app.request('/admin/api/users', {
        headers: { Cookie: `session=${sessionCookie}` },
      });
      expect(listRes.status).toBe(200);
      const listBody = await listRes.json();
      expect(listBody).toEqual({
        users: expect.arrayContaining([
          expect.objectContaining({
            sub: targetSub,
            email: 'listed-user@example.com',
            email_verified: false,
            role: 'user',
            managed_by: 'database',
          }),
        ]),
      });
      expect(JSON.stringify(listBody)).not.toContain('password_hash');

      const detailRes = await server.app.request(
        `/admin/api/users/${targetSub}`,
        {
          headers: { Cookie: `session=${sessionCookie}` },
        },
      );
      expect(detailRes.status).toBe(200);
      await expect(detailRes.json()).resolves.toEqual({
        user: expect.objectContaining({
          sub: targetSub,
          email: 'listed-user@example.com',
          email_verified: false,
          role: 'user',
          managed_by: 'database',
        }),
      });
    } finally {
      await server.cleanup();
    }
  });

  test('allows admins to update database-managed user fields', async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      admin: { enabled: true },
      users: [TEST_USER_CONFIG],
    });
    try {
      const targetSub = await createDatabaseUser(server.services, {
        email: 'editable-user@example.com',
        password: 'changemelater',
        role: 'user',
        emailVerified: false,
      });
      const sessionCookie = await createAuthenticatedSession(server.app);

      const res = await server.app.request(`/admin/api/users/${targetSub}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookie}`,
        },
        body: JSON.stringify({ role: 'admin', email_verified: true }),
      });

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({
        user: expect.objectContaining({
          sub: targetSub,
          role: 'admin',
          email_verified: true,
        }),
      });
    } finally {
      await server.cleanup();
    }
  });

  test('rejects non-admin list and update requests', async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      admin: { enabled: true },
      users: [
        {
          sub: 'non-admin-user-management',
          email: 'non-admin-user-management@example.com',
          password: 'changemelater',
          role: 'user',
        },
      ],
    });
    try {
      const targetSub = await createDatabaseUser(server.services, {
        email: 'non-admin-target@example.com',
        password: 'changemelater',
        role: 'user',
      });
      const sessionCookie = await createAuthenticatedSession(
        server.app,
        'non-admin-user-management@example.com',
        'changemelater',
      );

      const listRes = await server.app.request('/admin/api/users', {
        headers: { Cookie: `session=${sessionCookie}` },
      });
      expect(listRes.status).toBe(403);

      const updateRes = await server.app.request(
        `/admin/api/users/${targetSub}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `session=${sessionCookie}`,
          },
          body: JSON.stringify({ role: 'admin' }),
        },
      );
      expect(updateRes.status).toBe(403);
    } finally {
      await server.cleanup();
    }
  });

  test('rejects self-demotion while another admin exists', async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      admin: { enabled: true },
    });
    try {
      const actorSub = await createDatabaseUser(server.services, {
        email: 'self-demotion-admin@example.com',
        password: 'changemelater',
        role: 'admin',
      });
      await createDatabaseUser(server.services, {
        email: 'other-admin@example.com',
        password: 'changemelater',
        role: 'admin',
      });
      const sessionCookie = await createAuthenticatedSession(
        server.app,
        'self-demotion-admin@example.com',
        'changemelater',
      );

      const res = await server.app.request(`/admin/api/users/${actorSub}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `session=${sessionCookie}`,
        },
        body: JSON.stringify({ role: 'user' }),
      });

      expect(res.status).toBe(403);
      await expect(res.json()).resolves.toEqual({
        code: 'SELF_DEMOTION_NOT_ALLOWED',
        message: 'Admins cannot remove their own admin role.',
      });
    } finally {
      await server.cleanup();
    }
  });

  test('rejects demoting or deleting the last admin', async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      admin: { enabled: true },
    });
    try {
      const actorSub = await createDatabaseUser(server.services, {
        email: 'last-admin@example.com',
        password: 'changemelater',
        role: 'admin',
      });
      const sessionCookie = await createAuthenticatedSession(
        server.app,
        'last-admin@example.com',
        'changemelater',
      );

      const demoteRes = await server.app.request(
        `/admin/api/users/${actorSub}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `session=${sessionCookie}`,
          },
          body: JSON.stringify({ email_verified: true, role: 'user' }),
        },
      );
      expect(demoteRes.status).toBe(409);
      await expect(demoteRes.json()).resolves.toEqual({
        code: 'LAST_ADMIN_REQUIRED',
        message: 'At least one admin user must remain.',
      });

      const deleteRes = await server.app.request(
        `/admin/api/users/${actorSub}`,
        {
          method: 'DELETE',
          headers: { Cookie: `session=${sessionCookie}` },
        },
      );
      expect(deleteRes.status).toBe(409);
      await expect(deleteRes.json()).resolves.toEqual({
        code: 'LAST_ADMIN_REQUIRED',
        message: 'At least one admin user must remain.',
      });
    } finally {
      await server.cleanup();
    }
  });

  test('rejects config-managed user mutation and safe-deletes are explicit', async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      admin: { enabled: true },
      users: [TEST_USER_CONFIG],
    });
    try {
      await createDatabaseUser(server.services, {
        email: 'database-admin@example.com',
        password: 'changemelater',
        role: 'admin',
      });
      const databaseUserSub = await createDatabaseUser(server.services, {
        email: 'delete-target@example.com',
        password: 'changemelater',
        role: 'user',
      });
      const sessionCookie = await createAuthenticatedSession(
        server.app,
        'database-admin@example.com',
        'changemelater',
      );

      const configRes = await server.app.request(
        `/admin/api/users/${TEST_USER_CONFIG.sub}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `session=${sessionCookie}`,
          },
          body: JSON.stringify({ role: 'user' }),
        },
      );
      expect(configRes.status).toBe(403);
      await expect(configRes.json()).resolves.toEqual({
        code: 'USER_NOT_EDITABLE',
        message: 'This user account cannot be modified.',
      });

      const deleteRes = await server.app.request(
        `/admin/api/users/${databaseUserSub}`,
        {
          method: 'DELETE',
          headers: { Cookie: `session=${sessionCookie}` },
        },
      );
      expect(deleteRes.status).toBe(501);
      await expect(deleteRes.json()).resolves.toEqual({
        code: 'USER_DELETE_NOT_IMPLEMENTED',
        message: 'Admin user deletion is not implemented.',
      });
    } finally {
      await server.cleanup();
    }
  });
});

describe('createApp admin OAuth client management API', () => {
  test('allows admins to list and inspect OAuth clients without secret fields', async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      admin: { enabled: true },
      clients: [TEST_OAUTH_CLIENT_CONFIG],
      users: [TEST_USER_CONFIG],
    });
    try {
      const databaseClientId = await createTestOAuthClient(server.services, {
        clientId: 'database-admin-client',
        name: 'Database admin client',
        redirectUris: ['https://client.example/callback'],
      });
      const sessionCookie = await createAuthenticatedSession(server.app);

      const listRes = await server.app.request('/admin/api/oauth-clients', {
        headers: { Cookie: `session=${sessionCookie}` },
      });
      expect(listRes.status).toBe(200);
      const listBody = await listRes.json();
      expect(listBody).toEqual({
        oauth_clients: expect.arrayContaining([
          expect.objectContaining({
            id: databaseClientId,
            client_id: 'database-admin-client',
            name: 'Database admin client',
            redirect_uris: ['https://client.example/callback'],
            response_types: ['code'],
            grant_types: ['authorization_code'],
            scope: 'openid profile email',
            enabled: true,
            managed_by: 'database',
          }),
        ]),
      });
      expect(JSON.stringify(listBody)).not.toContain('client_secret');
      expect(JSON.stringify(listBody)).not.toContain('clientSecretHash');
      expect(JSON.stringify(listBody)).not.toContain('test-secret-hash');

      const detailRes = await server.app.request(
        `/admin/api/oauth-clients/${databaseClientId}`,
        {
          headers: { Cookie: `session=${sessionCookie}` },
        },
      );
      expect(detailRes.status).toBe(200);
      const detailBody = await detailRes.json();
      expect(detailBody).toEqual({
        oauth_client: expect.objectContaining({
          id: databaseClientId,
          client_id: 'database-admin-client',
          name: 'Database admin client',
        }),
      });
      expect(JSON.stringify(detailBody)).not.toContain('client_secret');
      expect(JSON.stringify(detailBody)).not.toContain('clientSecretHash');
    } finally {
      await server.cleanup();
    }
  });

  test('rejects non-admin OAuth client management requests', async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      admin: { enabled: true },
      users: [
        {
          sub: 'non-admin-oauth-client-management',
          email: 'non-admin-oauth-client-management@example.com',
          password: 'changemelater',
          role: 'user',
        },
      ],
    });
    try {
      const targetClientId = await createTestOAuthClient(server.services, {
        clientId: 'non-admin-target-client',
      });
      const sessionCookie = await createAuthenticatedSession(
        server.app,
        'non-admin-oauth-client-management@example.com',
        'changemelater',
      );
      const headers = { Cookie: `session=${sessionCookie}` };

      const listRes = await server.app.request('/admin/api/oauth-clients', {
        headers,
      });
      expect(listRes.status).toBe(403);

      const detailRes = await server.app.request(
        `/admin/api/oauth-clients/${targetClientId}`,
        { headers },
      );
      expect(detailRes.status).toBe(403);

      const createRes = await server.app.request('/admin/api/oauth-clients', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: 'forbidden-client',
          client_id: 'forbidden-client',
          name: 'Forbidden client',
          redirect_uris: ['https://client.example/callback'],
          response_types: ['code'],
          grant_types: ['authorization_code'],
          scope: 'openid',
        }),
      });
      expect(createRes.status).toBe(403);

      const updateRes = await server.app.request(
        `/admin/api/oauth-clients/${targetClientId}`,
        {
          method: 'PATCH',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Forbidden update' }),
        },
      );
      expect(updateRes.status).toBe(403);

      const deleteRes = await server.app.request(
        `/admin/api/oauth-clients/${targetClientId}`,
        {
          method: 'DELETE',
          headers,
        },
      );
      expect(deleteRes.status).toBe(403);
    } finally {
      await server.cleanup();
    }
  });

  test('validates redirect URI policy on create and update', async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      admin: { enabled: true },
      users: [TEST_USER_CONFIG],
    });
    try {
      const sessionCookie = await createAuthenticatedSession(server.app);
      const headers = {
        'Content-Type': 'application/json',
        Cookie: `session=${sessionCookie}`,
      };

      const invalidCreateRes = await server.app.request(
        '/admin/api/oauth-clients',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            id: 'invalid-create-client',
            client_id: 'invalid-create-client',
            name: 'Invalid create client',
            redirect_uris: ['http://evil.example/callback'],
            response_types: ['code'],
            grant_types: ['authorization_code'],
            scope: 'openid',
          }),
        },
      );
      expect(invalidCreateRes.status).toBe(400);

      const targetClientId = await createTestOAuthClient(server.services, {
        clientId: 'invalid-update-target-client',
      });
      const invalidUpdateRes = await server.app.request(
        `/admin/api/oauth-clients/${targetClientId}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            redirect_uris: ['https://client.example/callback#fragment'],
          }),
        },
      );
      expect(invalidUpdateRes.status).toBe(400);
    } finally {
      await server.cleanup();
    }
  });

  test('allows admins to create update and delete database-managed OAuth clients with audit events', async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      admin: { enabled: true },
      users: [TEST_USER_CONFIG],
    });
    try {
      const sessionCookie = await createAuthenticatedSession(server.app);
      const headers = {
        'Content-Type': 'application/json',
        Cookie: `session=${sessionCookie}`,
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent': 'admin-oauth-client-test',
      };

      const createRes = await server.app.request('/admin/api/oauth-clients', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: 'created-admin-client',
          client_id: 'created-admin-client',
          client_secret: 'created-admin-client-secret',
          name: 'Created admin client',
          redirect_uris: ['https://client.example/callback'],
          response_types: ['code'],
          grant_types: ['authorization_code'],
          scope: 'openid profile',
        }),
      });
      expect(createRes.status).toBe(201);
      const createBody = await createRes.json();
      expect(createBody).toEqual({
        oauth_client: expect.objectContaining({
          id: 'created-admin-client',
          client_id: 'created-admin-client',
          redirect_uris: ['https://client.example/callback'],
          scope: 'openid profile',
          managed_by: 'database',
        }),
      });
      expect(JSON.stringify(createBody)).not.toContain('client_secret');
      await withMikroContext(server.services, async () => {
        expect(
          await server.services.oauthClientService.verifyClientSecret(
            'created-admin-client',
            'created-admin-client-secret',
          ),
        ).toBe(true);
      });

      const updateRes = await server.app.request(
        '/admin/api/oauth-clients/created-admin-client',
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            name: 'Updated admin client',
            redirect_uris: ['http://localhost:3000/callback'],
            enabled: false,
          }),
        },
      );
      expect(updateRes.status).toBe(200);
      await expect(updateRes.json()).resolves.toEqual({
        oauth_client: expect.objectContaining({
          id: 'created-admin-client',
          name: 'Updated admin client',
          redirect_uris: ['http://localhost:3000/callback'],
          enabled: false,
        }),
      });

      const deleteRes = await server.app.request(
        '/admin/api/oauth-clients/created-admin-client',
        {
          method: 'DELETE',
          headers: { Cookie: `session=${sessionCookie}` },
        },
      );
      expect(deleteRes.status).toBe(204);

      const events = await server.services.mikro.em
        .getConnection()
        .execute(
          'select action, target_type, target_id, user_agent from admin_audit_event order by created_at asc',
        );
      expect(events).toEqual([
        expect.objectContaining({
          action: 'admin.oauth_client.create',
          target_type: 'oauth_client',
          target_id: 'created-admin-client',
          user_agent: 'admin-oauth-client-test',
        }),
        expect.objectContaining({
          action: 'admin.oauth_client.update',
          target_type: 'oauth_client',
          target_id: 'created-admin-client',
          user_agent: 'admin-oauth-client-test',
        }),
        expect.objectContaining({
          action: 'admin.oauth_client.delete',
          target_type: 'oauth_client',
          target_id: 'created-admin-client',
        }),
      ]);
    } finally {
      await server.cleanup();
    }
  });
});

describe('createApp admin audit events API', () => {
  test('persists audit event metadata IP and user agent through the audit service', async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      admin: { enabled: true },
      users: [TEST_USER_CONFIG],
    });
    try {
      await withMikroContext(server.services, async () => {
        await server.services.adminAuditService.record({
          actorSub: TEST_USER_CONFIG.sub,
          action: 'admin.test.persist',
          targetType: 'test_target',
          targetId: 'durable-audit-target',
          metadata: {
            nested: { enabled: true },
            values: ['one', 'two'],
          },
          ip: '203.0.113.10',
          userAgent: 'admin-audit-service-test',
        });
      });

      const rows = await server.services.mikro.em
        .getConnection()
        .execute(
          'select action, target_type, target_id, metadata_json, ip, user_agent from admin_audit_event where target_id = ? order by created_at asc',
          ['durable-audit-target'],
        );
      expect(rows).toHaveLength(1);
      const [row] = rows;
      if (!row) {
        throw new Error('Expected persisted audit event row');
      }
      expect(row).toEqual(
        expect.objectContaining({
          action: 'admin.test.persist',
          target_type: 'test_target',
          target_id: 'durable-audit-target',
          ip: '203.0.113.10',
          user_agent: 'admin-audit-service-test',
        }),
      );
      expect(JSON.parse(row.metadata_json)).toEqual({
        nested: { enabled: true },
        values: ['one', 'two'],
      });
    } finally {
      await server.cleanup();
    }
  });

  test('lists recent audit events for admins only', async () => {
    const nonAdminEmail = 'audit-list-user@example.com';
    const nonAdminPassword = 'changemelater';
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      admin: { enabled: true },
      users: [
        TEST_USER_CONFIG,
        {
          sub: 'audit-list-user',
          email: nonAdminEmail,
          password: nonAdminPassword,
          role: 'user',
        },
      ],
    });
    try {
      await withMikroContext(server.services, async () => {
        await server.services.adminAuditService.record({
          actorSub: TEST_USER_CONFIG.sub,
          action: 'admin.test.list',
          targetType: 'test_target',
          targetId: 'listed-audit-target',
          metadata: { listed: true },
          ip: '203.0.113.11',
          userAgent: 'admin-audit-list-test',
        });
      });

      const unauthenticatedRes = await server.app.request(
        '/admin/api/audit-events',
      );
      expect(unauthenticatedRes.status).toBe(401);

      const nonAdminSessionCookie = await createAuthenticatedSession(
        server.app,
        nonAdminEmail,
        nonAdminPassword,
      );
      const nonAdminRes = await server.app.request('/admin/api/audit-events', {
        headers: { Cookie: `session=${nonAdminSessionCookie}` },
      });
      expect(nonAdminRes.status).toBe(403);

      const adminSessionCookie = await createAuthenticatedSession(server.app);
      const adminRes = await server.app.request('/admin/api/audit-events', {
        headers: { Cookie: `session=${adminSessionCookie}` },
      });
      expect(adminRes.status).toBe(200);
      await expect(adminRes.json()).resolves.toEqual({
        audit_events: [
          expect.objectContaining({
            actor_sub: TEST_USER_CONFIG.sub,
            action: 'admin.test.list',
            target_type: 'test_target',
            target_id: 'listed-audit-target',
            metadata: { listed: true },
            ip: '203.0.113.11',
            user_agent: 'admin-audit-list-test',
          }),
        ],
        pagination: {
          limit: 50,
          offset: 0,
          total: 1,
        },
      });
    } finally {
      await server.cleanup();
    }
  });

  test('lists expected audit events from user and OAuth client mutations', async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      admin: { enabled: true },
      users: [TEST_USER_CONFIG],
    });
    try {
      const targetUserSub = await createDatabaseUser(server.services, {
        email: 'audit-mutated-user@example.com',
        password: 'changemelater',
        role: 'user',
      });
      const sessionCookie = await createAuthenticatedSession(server.app);
      const headers = {
        'Content-Type': 'application/json',
        Cookie: `session=${sessionCookie}`,
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent': 'admin-audit-mutation-test',
        'X-Real-IP': '203.0.113.12',
      };

      const updateUserRes = await server.app.request(
        `/admin/api/users/${targetUserSub}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ role: 'admin' }),
        },
      );
      expect(updateUserRes.status).toBe(200);

      const createClientRes = await server.app.request(
        '/admin/api/oauth-clients',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            id: 'audit-mutated-client',
            client_id: 'audit-mutated-client',
            name: 'Audit mutated client',
            redirect_uris: ['https://client.example/callback'],
            response_types: ['code'],
            grant_types: ['authorization_code'],
            scope: 'openid',
          }),
        },
      );
      expect(createClientRes.status).toBe(201);

      const updateClientRes = await server.app.request(
        '/admin/api/oauth-clients/audit-mutated-client',
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ name: 'Audit mutated client updated' }),
        },
      );
      expect(updateClientRes.status).toBe(200);

      const deleteClientRes = await server.app.request(
        '/admin/api/oauth-clients/audit-mutated-client',
        {
          method: 'DELETE',
          headers,
        },
      );
      expect(deleteClientRes.status).toBe(204);

      const listRes = await server.app.request('/admin/api/audit-events', {
        headers: { Cookie: `session=${sessionCookie}` },
      });
      expect(listRes.status).toBe(200);
      const body = await listRes.json();
      expect(body.audit_events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: 'admin.user.update',
            target_type: 'user',
            target_id: targetUserSub,
            metadata: expect.objectContaining({
              before: expect.objectContaining({ role: 'user' }),
              after: expect.objectContaining({ role: 'admin' }),
            }),
            ip: '203.0.113.12',
            user_agent: 'admin-audit-mutation-test',
          }),
          expect.objectContaining({
            action: 'admin.oauth_client.create',
            target_type: 'oauth_client',
            target_id: 'audit-mutated-client',
            metadata: expect.objectContaining({
              after: expect.objectContaining({
                id: 'audit-mutated-client',
                name: 'Audit mutated client',
              }),
            }),
          }),
          expect.objectContaining({
            action: 'admin.oauth_client.update',
            target_type: 'oauth_client',
            target_id: 'audit-mutated-client',
            metadata: expect.objectContaining({
              before: expect.objectContaining({ name: 'Audit mutated client' }),
              after: expect.objectContaining({
                name: 'Audit mutated client updated',
              }),
            }),
          }),
          expect.objectContaining({
            action: 'admin.oauth_client.delete',
            target_type: 'oauth_client',
            target_id: 'audit-mutated-client',
            metadata: expect.objectContaining({
              before: expect.objectContaining({
                name: 'Audit mutated client updated',
              }),
            }),
          }),
        ]),
      );
    } finally {
      await server.cleanup();
    }
  });
});
