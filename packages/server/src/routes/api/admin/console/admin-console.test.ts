import { testClient } from 'hono/testing';
import { describe, expect, test } from 'vitest';
import type { AppType } from '../../../../entrypoints/app.ts';
import {
  assertJsonBody,
  createTestApp,
  extractCookie,
  MINIMAL_TEST_CONFIG,
  TEST_USER,
  TEST_USER_CONFIG,
} from '../../../../test-utils/index.ts';

async function createAdminApp() {
  return createTestApp({
    ...MINIMAL_TEST_CONFIG,
    admin: { enabled: true },
    users: [TEST_USER_CONFIG],
  });
}

async function login(app: AppType) {
  const response = await testClient(app).api.auth.login.$post({
    json: { email: TEST_USER.email, password: TEST_USER.password },
  });
  expect(response.status).toBe(200);
  return extractCookie(response, 'session');
}

function headers(session: string) {
  return { headers: { Cookie: `session=${session}` } };
}

describe('admin console API', () => {
  test('creates confidential clients and exposes secrets only on create and rotation', async () => {
    const server = await createAdminApp();
    try {
      const session = await login(server.app);
      const admin = testClient(server.app).api.admin;
      const created = await admin.clients.$post(
        {
          json: {
            client_id: 'admin-created-client',
            name: 'Admin created client',
            type: 'confidential',
            redirect_uris: ['https://client.example/callback'],
            post_logout_redirect_uris: [],
            web_origins: ['https://client.example'],
            grant_types: ['authorization_code'],
            response_types: ['code'],
            scopes: ['openid', 'profile'],
            skip_consent: false,
          },
        },
        headers(session),
      );
      expect(created.status).toBe(201);
      const createdBody = await assertJsonBody(created, 201);
      expect(createdBody.client_secret).toEqual(expect.any(String));

      const listed = await admin.clients.$get(
        { query: { page: '1', page_size: '20', direction: 'asc' } },
        headers(session),
      );
      const listBody = await assertJsonBody(listed);
      expect(JSON.stringify(listBody)).not.toContain(createdBody.client_secret);
      expect(JSON.stringify(listBody)).not.toContain('client_secret_hash');

      const rotated = await admin.clients[':id']['rotate-secret'].$post(
        { param: { id: createdBody.client.id } },
        headers(session),
      );
      const rotatedBody = await assertJsonBody(rotated);
      expect(rotatedBody.client_secret).toEqual(expect.any(String));
      expect(rotatedBody.client_secret).not.toBe(createdBody.client_secret);
    } finally {
      await server.cleanup();
    }
  });

  test('archives terms without deleting consent definitions and excludes them from public flows', async () => {
    const server = await createAdminApp();
    try {
      const session = await login(server.app);
      const client = testClient(server.app);
      const created = await client.api.admin.terms.$post(
        {
          json: {
            id: 'privacy-admin',
            required: true,
            consent_mode: 'explicit',
            version: '1.0.0',
            contents: [
              {
                lang: 'en',
                title: 'Privacy',
                type: 'text',
                content: 'Privacy terms',
              },
            ],
          },
        },
        headers(session),
      );
      expect(created.status).toBe(201);

      const archived = await client.api.admin.terms['bulk-status'].$post(
        {
          json: {
            target: { kind: 'ids', ids: ['privacy-admin'] },
            active: false,
          },
        },
        headers(session),
      );
      expect(await assertJsonBody(archived)).toMatchObject({
        matched: 1,
        changed: 1,
      });

      const publicTerms = await client.api.terms.$get({
        query: { lang: 'en' },
      });
      const publicBody = await assertJsonBody(publicTerms);
      expect(publicBody.terms).toHaveLength(0);

      const adminTerms = await client.api.admin.terms.$get(
        {
          query: {
            page: '1',
            page_size: '20',
            direction: 'asc',
            archived: 'true',
          },
        },
        headers(session),
      );
      const adminBody = await assertJsonBody(adminTerms);
      expect(adminBody.terms[0]?.archived_at).toEqual(expect.any(String));
    } finally {
      await server.cleanup();
    }
  });

  test('returns overview and safe read-only system settings without secrets', async () => {
    const server = await createAdminApp();
    try {
      const session = await login(server.app);
      const admin = testClient(server.app).api.admin;
      const overview = await assertJsonBody(
        await admin.overview.$get({}, headers(session)),
      );
      expect(overview.metrics.admins).toBe(1);
      expect(overview.status.database).toBe('healthy');

      const system = await assertJsonBody(
        await admin.system.$get({}, headers(session)),
      );
      const serialized = JSON.stringify(system);
      expect(serialized).not.toContain('hash_secret');
      expect(serialized).not.toContain('session_secret');
      expect(serialized).not.toContain('client_secret');
      expect(serialized).not.toContain('createTransport');
      expect(system.sections.length).toBeGreaterThan(0);
    } finally {
      await server.cleanup();
    }
  });
});
