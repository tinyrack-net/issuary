import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { ServiceContainer } from '#backend/services/container.js';
import {
  createTestApp,
  createTestEmailConfig,
  MINIMAL_TEST_CONFIG,
} from '#backend/test-utils/index.js';
import type { TestEmailMessage } from '#backend/test-utils/setup.js';

describe('EmailService', () => {
  describe('with email enabled', () => {
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;
    let sentMessages: TestEmailMessage[];

    beforeAll(async () => {
      sentMessages = [];
      const email = await createTestEmailConfig({
        from: 'no-reply@test.local',
        sentMessages,
      });

      const server = await createTestApp({
        ...MINIMAL_TEST_CONFIG,
        email,
        server: {
          public_origin: 'https://auth.example.com',
        },
        i18n: {
          fallback_language: 'ja',
        },
        branding: {
          title: {
            ja: 'Fallback App',
          },
        },
      });

      services = server.services;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    test('uses the fallback-language app title when the requested locale is missing', async () => {
      sentMessages.length = 0;

      await services.emailService.sendVerificationEmail({
        email: 'user@example.com',
        token: 'verify-token-123',
        locale: 'ko',
      });

      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]?.from).toBe('no-reply@test.local');
      expect(sentMessages[0]?.to).toBe('user@example.com');
      expect(sentMessages[0]?.html).toContain('Fallback App');
      expect(sentMessages[0]?.html).toContain(
        '/verify/email?token=verify-token-123',
      );
    });

    test('uses the configured origin and sender for password reset emails', async () => {
      sentMessages.length = 0;

      await services.emailService.sendPasswordResetEmail({
        email: 'reset@example.com',
        token: 'reset-token-123',
        locale: 'en',
      });

      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0]?.from).toBe('no-reply@test.local');
      expect(sentMessages[0]?.to).toBe('reset@example.com');
      expect(sentMessages[0]?.html).toContain(
        'https://auth.example.com/password/reset?token=reset-token-123',
      );
      expect(sentMessages[0]?.subject).toBeTruthy();
    });
  });

  describe('with email disabled', () => {
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp(MINIMAL_TEST_CONFIG);
      services = server.services;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    test('rejects verification emails when email is not configured', async () => {
      await expect(
        services.emailService.sendVerificationEmail({
          email: 'user@example.com',
          token: 'verify-token-123',
        }),
      ).rejects.toHaveProperty('code', 'EMAIL_NOT_ACTIVATED');
    });
  });
});
