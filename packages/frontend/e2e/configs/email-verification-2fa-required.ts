import type { StandaloneConfigInput } from '@tinyauth/standalone/config';
import {
  E2E_TEST_CLIENT_CONFIG,
  E2E_TEST_SECURITY_CONFIG,
  E2E_TEST_USER_CONFIG,
} from '#frontend-e2e/fixtures/index.js';

/**
 * Creates an email-verification + required 2FA backend configuration.
 * Both TOTP and passkey are enabled to test /verify/email continuation.
 */
export function createEmailVerification2faRequiredConfig(
  backendPort: number,
  frontendPort: number,
): StandaloneConfigInput {
  return {
    app: {
      host: `http://localhost:${backendPort}`,
      port: backendPort,
      cookie_secret:
        '20d4e6f8a0b2c4d6e8f0112233445566778899aabbccddeeff00112233445566',
      allowed_signup_emails: ['*'],
      supported_languages: ['en'],
      default_language: 'en',
      fallback_language: 'en',
      frontend: {
        enabled: true,
        mode: 'proxy',
        path: `http://localhost:${frontendPort}`,
      },
    },
    security: E2E_TEST_SECURITY_CONFIG,
    auth: {
      password: {
        enabled: true,
        email_verification: true,
        second_factor: {
          required: true,
        },
        totp: {
          enabled: true,
          issuer: 'TinyauthE2E',
        },
      },
      passkey: {
        enabled: true,
      },
    },
    smtp: {
      test: true,
    },
    logging: {
      level: 'silent',
      format: 'json',
    },
    database: {
      type: 'sqlite',
      test: true,
    },
    users: [E2E_TEST_USER_CONFIG],
    clients: [E2E_TEST_CLIENT_CONFIG],
  };
}
