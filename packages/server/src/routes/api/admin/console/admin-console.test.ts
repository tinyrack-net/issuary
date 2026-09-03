import { testClient } from 'hono/testing';
import { describe, expect, test } from 'vitest';
import type { AppType } from '../../../../entrypoints/app.ts';
import {
  assertJsonBody,
  createTestApp,
  extractCookie,
  MINIMAL_TEST_CONFIG,
  TEST_OAUTH_CLIENT_CONFIG,
  TEST_USER,
  TEST_USER_CONFIG,
} from '../../../../test-utils/index.ts';

async function createAdminApp() {
  return createTestApp({
    ...MINIMAL_TEST_CONFIG,
    admin: { enabled: true },
    clients: [TEST_OAUTH_CLIENT_CONFIG],
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
        {
          query: {
            query: 'admin-created-client',
            page: '1',
            page_size: '20',
            direction: 'asc',
          },
        },
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

  test('soft-deletes and restores database clients while keeping config clients read-only', async () => {
    const server = await createAdminApp();
    try {
      const session = await login(server.app);
      const admin = testClient(server.app).api.admin;
      const created = await admin.clients.$post(
        {
          json: {
            client_id: 'admin-client-lifecycle',
            name: 'Lifecycle client',
            type: 'public',
            redirect_uris: ['https://client.example/callback'],
            post_logout_redirect_uris: [],
            web_origins: [],
            grant_types: ['authorization_code'],
            response_types: ['code'],
            scopes: ['openid'],
            skip_consent: false,
          },
        },
        headers(session),
      );
      const createdBody = await assertJsonBody(created, 201);

      const deleted = await admin.clients[':id'].$delete(
        { param: { id: createdBody.client.id } },
        headers(session),
      );
      const deletedBody = await assertJsonBody(deleted);
      expect(deletedBody.client.deleted_at).toEqual(expect.any(String));
      const deletedAgain = await admin.clients[':id'].$delete(
        { param: { id: createdBody.client.id } },
        headers(session),
      );
      expect((await assertJsonBody(deletedAgain)).client.deleted_at).toBe(
        deletedBody.client.deleted_at,
      );

      const current = await admin.clients.$get(
        {
          query: {
            query: 'admin-client-lifecycle',
            page: '1',
            page_size: '20',
            direction: 'asc',
          },
        },
        headers(session),
      );
      expect((await assertJsonBody(current)).clients).toHaveLength(0);

      const deletedList = await admin.clients.$get(
        {
          query: {
            page: '1',
            page_size: '20',
            direction: 'asc',
            query: 'admin-client-lifecycle',
            lifecycle_status: 'deleted',
          },
        },
        headers(session),
      );
      expect((await assertJsonBody(deletedList)).clients).toHaveLength(1);

      const deletedUpdate = await admin.clients[':id'].$patch(
        {
          param: { id: createdBody.client.id },
          json: {
            name: 'Still deleted',
            redirect_uris: ['https://client.example/callback'],
            post_logout_redirect_uris: [],
            web_origins: [],
            grant_types: ['authorization_code'],
            response_types: ['code'],
            scopes: ['openid'],
            skip_consent: false,
          },
        },
        headers(session),
      );
      expect(deletedUpdate.status).toBe(409);

      const deletedRotation = await admin.clients[':id']['rotate-secret'].$post(
        { param: { id: createdBody.client.id } },
        headers(session),
      );
      expect(deletedRotation.status).toBe(409);

      const deletedBulkChange = await admin.clients['bulk-status'].$post(
        {
          json: {
            target: { kind: 'ids', ids: [createdBody.client.id] },
            active: false,
          },
        },
        headers(session),
      );
      expect(deletedBulkChange.status).toBe(409);

      const duplicate = await admin.clients.$post(
        {
          json: {
            client_id: 'admin-client-lifecycle',
            name: 'Duplicate lifecycle client',
            type: 'public',
            redirect_uris: ['https://client.example/callback'],
            post_logout_redirect_uris: [],
            web_origins: [],
            grant_types: ['authorization_code'],
            response_types: ['code'],
            scopes: ['openid'],
            skip_consent: false,
          },
        },
        headers(session),
      );
      expect(duplicate.status).toBe(409);

      const restored = await admin.clients[':id'].restore.$post(
        { param: { id: createdBody.client.id } },
        headers(session),
      );
      expect((await assertJsonBody(restored)).client.deleted_at).toBeNull();
      const restoredAgain = await admin.clients[':id'].restore.$post(
        { param: { id: createdBody.client.id } },
        headers(session),
      );
      expect(
        (await assertJsonBody(restoredAgain)).client.deleted_at,
      ).toBeNull();

      const configDelete = await admin.clients[':id'].$delete(
        { param: { id: TEST_OAUTH_CLIENT_CONFIG.id } },
        headers(session),
      );
      expect(configDelete.status).toBe(403);

      const configBulkChange = await admin.clients['bulk-status'].$post(
        {
          json: {
            target: { kind: 'ids', ids: [TEST_OAUTH_CLIENT_CONFIG.id] },
            active: false,
          },
        },
        headers(session),
      );
      expect(configBulkChange.status).toBe(403);
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
