import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '#backend/entrypoints/app.js';
import { e } from '#backend/schemas/error.js';
import type { ServiceContainer } from '#backend/services/container.js';
import {
  assertJsonBody,
  createAuthenticatedSession,
  createDbUserWithSession,
  createTestApp,
  expectError,
  generateUniqueEmail,
  MINIMAL_TEST_CONFIG,
  TEST_USER,
  TEST_USER_CONFIG,
  withMikroContext,
} from '#backend/test-utils/index.js';

/**
 * Test suite for DELETE /api/user endpoint.
 *
 * Note: Account deletion is disabled by default in test config,
 * so we use configOverrides to enable it for most tests.
 */

describe('DELETE /api/user', () => {
  describe('with account deletion enabled', () => {
    let app: AppType;
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp({
        ...MINIMAL_TEST_CONFIG,
        account_deletion: {
          enabled: true,
          retention: '30d',
        },
        users: [TEST_USER_CONFIG],
      });
      app = server.app;
      services = server.services;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should delete account successfully', async () => {
      // Create a new database user for this test
      const email = generateUniqueEmail('delete-user');
      const password = 'testPassword123';

      const { sessionCookie } = await createDbUserWithSession(
        app,
        services,
        email,
        password,
      );

      // Delete the account
      const client = testClient(app);
      const deleteRes = await client.api.user.$delete(
        {},
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      const body = await assertJsonBody(deleteRes);
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
      await withMikroContext(services, async () => {
        const user = await services.mikro.user.findOne({ email });
        expect(user).not.toBeNull();
        expect(user?.deleted_at).not.toBeNull();
      });
    });

    test('should fail if not authenticated', async () => {
      const client = testClient(app);
      const res = await client.api.user.$delete();

      await expectError(res, e.Unauthorized);
    });

    test('should fail for config-managed users', async () => {
      // Login as config-managed user (TEST_USER is config-managed in test)
      const sessionCookie = await createAuthenticatedSession(
        app,
        TEST_USER.email,
        TEST_USER.password,
      );

      const client = testClient(app);
      const res = await client.api.user.$delete(
        {},
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      await expectError(res, e.UserNotEditable);
    });

    test('should fail if account already deleted', async () => {
      // Create a new database user
      const email = generateUniqueEmail('already-deleted');
      const password = 'testPassword123';

      const { sessionCookie } = await createDbUserWithSession(
        app,
        services,
        email,
        password,
      );

      // Manually soft-delete the user in database
      await withMikroContext(services, async () => {
        const user = await services.mikro.user.findOneOrFail({
          email,
        });
        user.deleted_at = new Date();
        await services.mikro.em.flush();
      });

      // Try to delete again
      const client = testClient(app);
      const res = await client.api.user.$delete(
        {},
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      await expectError(res, e.AccountAlreadyDeleted);
    });

    test('should set deleted_at in database after deletion', async () => {
      // Create a new database user
      const email = generateUniqueEmail('delete-db-check');
      const password = 'testPassword123';

      const { sessionCookie } = await createDbUserWithSession(
        app,
        services,
        email,
        password,
      );

      // Verify user is not deleted initially
      await withMikroContext(services, async () => {
        const user = await services.mikro.user.findOneOrFail({
          email,
        });
        expect(user.deleted_at).toBeNull();
      });

      // Delete the account
      const client = testClient(app);
      const deleteRes = await client.api.user.$delete(
        {},
        { headers: { Cookie: `session=${sessionCookie}` } },
      );
      expect(deleteRes.status).toBe(200);

      // Verify deleted_at is set in database
      await withMikroContext(services, async () => {
        const user = await services.mikro.user.findOneOrFail({
          email,
        });
        expect(user.deleted_at).not.toBeNull();
        expect(user.deleted_at).toBeInstanceOf(Date);
      });
    });
  });

  describe('with account deletion disabled', () => {
    let app: AppType;
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp({
        ...MINIMAL_TEST_CONFIG,
        account_deletion: {
          enabled: false,
        },
      });
      app = server.app;
      services = server.services;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should fail when account deletion is disabled', async () => {
      // Create a new database user
      const email = generateUniqueEmail('delete-disabled');
      const password = 'testPassword123';

      const { sessionCookie } = await createDbUserWithSession(
        app,
        services,
        email,
        password,
      );

      const client = testClient(app);
      const res = await client.api.user.$delete(
        {},
        { headers: { Cookie: `session=${sessionCookie}` } },
      );

      await expectError(res, e.AccountDeletionDisabled);
    });
  });
});
