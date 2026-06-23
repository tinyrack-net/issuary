import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
  createTestApp,
  createTestEmailConfig,
  MINIMAL_TEST_CONFIG,
} from '../test-utils/index.ts';
import type { ServiceContainer } from './container.ts';

describe('UserService', () => {
  let services: ServiceContainer;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const email = await createTestEmailConfig();
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      email,
      registration: {
        email_verification_required: true,
      },
      auth: {
        password: {
          two_factor: {
            enrollment_required: true,
          },
          totp: {
            enabled: true,
          },
        },
        passkey: {
          enabled: true,
        },
      },
    });
    services = server.services;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('buildSessionUser exposes config-driven session flags for database users', async () => {
    const sessionUser = await services.userService.buildSessionUser({
      user: {
        sub: 'session-user-sub',
        managed_by: 'database',
        email: 'session-user@example.com',
        role: 'user',
        email_verified: true,
        hasPassword: () => true,
      },
      totpRegistered: false,
      passkeyCount: 1,
    });

    expect(sessionUser.email_verification_required).toBe(true);
    expect(sessionUser.second_factor_required).toBe(true);
    expect(sessionUser.totp_recovery_codes_missing).toBe(false);
    expect(sessionUser.passkey_count).toBe(1);
  });

  test('config-managed users skip email verification and second-factor enrollment', async () => {
    expect(
      services.userService.userEmailVerificationRequired({
        managed_by: 'config',
      }),
    ).toBe(false);
    expect(
      services.userService.user2FASetupRequired({
        managed_by: 'config',
      }),
    ).toBe(false);
  });

  test('getAvailable2FASetupMethods returns the enabled setup methods', async () => {
    expect(services.userService.getAvailable2FASetupMethods()).toEqual([
      'totp',
      'passkey',
    ]);
  });
});
