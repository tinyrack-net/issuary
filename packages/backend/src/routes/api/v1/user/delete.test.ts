import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { e } from '@/schemas/error.js';
import { createServer } from '@/server.js';
import {
  createAuthenticatedSession,
  createDbUserWithSession,
  expectError,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_USER,
  TEST_USER_CONFIG,
  withMikroContext,
} from '@/test-utils/index.js';

/**
 * Test suite for DELETE /api/v1/user endpoint.
 *
 * Note: Account deletion is disabled by default in test config,
 * so we use configOverrides to enable it for most tests.
 */

describe('DELETE /api/v1/user', () => {
  describe('with account deletion enabled', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          app: {
            ...MINIMAL_TEST_CONFIG.app,
            account_deletion: true,
          },
          users: [TEST_USER_CONFIG],
          cleanup: {
            deleted_users: {
              enabled: true,
              retention: '30d',
            },
          },
        },
      });
    });

    afterAll(async () => {
      await app.close();
    });

    test('should delete account successfully', async () => {
      // Create a new database user for this test
      const email = generateUniqueEmail('delete-user');
      const password = 'testPassword123';

      const { sessionCookie } = await createDbUserWithSession(
        app,
        email,
        password,
      );

      // Delete the account
      const deleteRes = await app.inject({
        method: 'DELETE',
        url: '/api/v1/user',
        cookies: { session: sessionCookie },
      });

      expect(deleteRes.statusCode).toBe(200);
      const body = deleteRes.json();
      expect(body.ok).toBe(true);
      expect(body.deleted_at).toBeDefined();
      expect(body.permanent_deletion_at).toBeDefined();

      // Verify the dates are valid ISO strings
      expect(() => new Date(body.deleted_at)).not.toThrow();
      expect(() => new Date(body.permanent_deletion_at)).not.toThrow();

      // Verify permanent_deletion_at is approximately 30 days after deleted_at
      const deletedAt = new Date(body.deleted_at);
      const permanentDeletionAt = new Date(body.permanent_deletion_at);
      const diffDays =
        (permanentDeletionAt.getTime() - deletedAt.getTime()) /
        (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(30, 0);

      // Verify user is soft-deleted in database
      await withMikroContext(app, async () => {
        const user = await app.mikro.user.findOne({ email });
        expect(user).not.toBeNull();
        expect(user?.deleted_at).not.toBeNull();
      });
    });

    test('should fail if not authenticated', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/user',
      });

      expectError(res, e.Unauthorized);
    });

    test('should fail for config-managed users', async () => {
      // Login as config-managed user (TEST_USER is config-managed in test)
      const sessionCookie = await createAuthenticatedSession(
        app,
        TEST_USER.email,
        TEST_USER.password,
      );

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/user',
        cookies: { session: sessionCookie },
      });

      expectError(res, e.UserNotEditable);
    });

    test('should fail if account already deleted', async () => {
      // Create a new database user
      const email = generateUniqueEmail('already-deleted');
      const password = 'testPassword123';

      const { sessionCookie } = await createDbUserWithSession(
        app,
        email,
        password,
      );

      // Manually soft-delete the user in database
      await withMikroContext(app, async () => {
        const user = await app.mikro.user.findOneOrFail({ email });
        user.deleted_at = new Date();
        await app.mikro.em.flush();
      });

      // Try to delete again
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/user',
        cookies: { session: sessionCookie },
      });

      expectError(res, e.AccountAlreadyDeleted);
    });

    test('should set deleted_at in database after deletion', async () => {
      // Create a new database user
      const email = generateUniqueEmail('delete-db-check');
      const password = 'testPassword123';

      const { sessionCookie } = await createDbUserWithSession(
        app,
        email,
        password,
      );

      // Verify user is not deleted initially
      await withMikroContext(app, async () => {
        const user = await app.mikro.user.findOneOrFail({ email });
        expect(user.deleted_at).toBeNull();
      });

      // Delete the account
      const deleteRes = await app.inject({
        method: 'DELETE',
        url: '/api/v1/user',
        cookies: { session: sessionCookie },
      });
      expect(deleteRes.statusCode).toBe(200);

      // Verify deleted_at is set in database
      await withMikroContext(app, async () => {
        const user = await app.mikro.user.findOneOrFail({ email });
        expect(user.deleted_at).not.toBeNull();
        expect(user.deleted_at).toBeInstanceOf(Date);
      });
    });
  });

  describe('with account deletion disabled', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = await createServer({
        config: {
          ...MINIMAL_TEST_CONFIG,
          app: {
            ...MINIMAL_TEST_CONFIG.app,
            account_deletion: false,
          },
        },
      });
    });

    afterAll(async () => {
      await app.close();
    });

    test('should fail when account deletion is disabled', async () => {
      // Create a new database user
      const email = generateUniqueEmail('delete-disabled');
      const password = 'testPassword123';

      const { sessionCookie } = await createDbUserWithSession(
        app,
        email,
        password,
      );

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/user',
        cookies: { session: sessionCookie },
      });

      expectError(res, e.AccountDeletionDisabled);
    });
  });
});
