import type { AppConfigInput } from '@tinyauth/backend';
import {
  E2E_TEST_CLIENT_CONFIG,
  E2E_TEST_USER_CONFIG,
} from '#frontend-e2e/fixtures/index.js';

/**
 * Creates a TOTP-required backend configuration for e2e tests.
 * TOTP is enabled and second factor is required.
 */
export function createTotpRequiredConfig(
  backendPort: number,
  frontendPort: number,
): AppConfigInput {
  return {
    app: {
      host: `http://localhost:${backendPort}`,
      port: backendPort,
      cookie_secret:
        'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
      allowed_signup_emails: ['*'],
      frontend: {
        enabled: true,
        mode: 'proxy',
        path: `http://localhost:${frontendPort}`,
      },
    },
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
