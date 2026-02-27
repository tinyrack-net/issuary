import type { AppConfigInput } from '@tinyauth/backend';
import {
  E2E_TEST_CLIENT_CONFIG,
  E2E_TEST_USER_CONFIG,
} from '#frontend-e2e/fixtures/index.js';

/**
 * Creates a passkey-optional configuration for e2e tests.
 * Passkey is enabled, TOTP is disabled, and second factor is optional.
 */
export function createPasskeyOptionalConfig(
  backendPort: number,
  frontendPort: number,
): AppConfigInput {
  return {
    app: {
      host: `http://localhost:${backendPort}`,
      port: backendPort,
      cookie_secret:
        '10d4e6f8a0b2c4d6e8f0112233445566778899aabbccddeeff00112233445566',
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
    auth: {
      password: {
        enabled: true,
        email_verification: false,
        second_factor: {
          required: false,
        },
        totp: {
          enabled: false,
          issuer: 'TinyauthE2E',
        },
      },
      passkey: {
        enabled: true,
      },
    },
    logging: {
      level: 'silent',
      format: 'json',
    },
    database: {
      type: 'memory',
    },
    users: [E2E_TEST_USER_CONFIG],
    clients: [E2E_TEST_CLIENT_CONFIG],
  };
}
