import {
  E2E_TEST_CLIENT_CONFIG,
  E2E_TEST_USER_CONFIG,
} from '@frontend-e2e/fixtures/index.js';
import type { AppConfigInput } from '@tinyauth/backend/app';

/**
 * Creates a password-disabled backend configuration for e2e tests.
 * Password auth is disabled while passkey and OAuth login methods remain.
 */
export function createPasswordDisabledConfig(
  backendPort: number,
  frontendPort: number,
): AppConfigInput {
  return {
    app: {
      host: `http://localhost:${backendPort}`,
      port: backendPort,
      cookie_secret:
        '33d4e6f8a0b2c4d6e8f0112233445566778899aabbccddeeff00112233445566',
      allowed_signup_emails: ['*'],
      frontend: {
        enabled: true,
        mode: 'proxy',
        path: `http://localhost:${frontendPort}`,
      },
    },
    auth: {
      password: {
        enabled: false,
      },
      passkey: {
        enabled: true,
      },
    },
    identity_providers: [
      {
        id: 'google',
        type: 'google',
        enabled: true,
        display_name: 'Google',
        client_id: 'test-google-client-id',
        client_secret: 'test-google-client-secret',
        email_conflict_strategy: 'auto_link',
      },
    ],
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
