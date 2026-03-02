import type { AppConfigInput } from '@tinyauth/backend';
import {
  E2E_TEST_CLIENT_CONFIG,
  E2E_TEST_USER_CONFIG,
} from '#frontend-e2e/fixtures/index.js';

/**
 * Creates an oauth-providers backend configuration for e2e tests.
 */
export function createOauthProvidersConfig(
  backendPort: number,
  frontendPort: number,
): AppConfigInput {
  return {
    app: {
      host: `http://localhost:${backendPort}`,
      port: backendPort,
      cookie_secret:
        '55d4e6f8a0b2c4d6e8f0112233445566778899aabbccddeeff00112233445566',
      allowed_signup_emails: ['*'],
      frontend: {
        enabled: true,
        mode: 'proxy',
        path: `http://localhost:${frontendPort}`,
      },
    },
    identity_providers: [
      {
        id: 'github',
        type: 'github',
        enabled: true,
        display_name: 'GitHub',
        icon_url: 'https://example.com/github.svg',
        client_id: 'test-github-client-id',
        client_secret: 'test-github-client-secret',
        email_conflict_strategy: 'auto_link',
      },
      {
        id: 'google',
        type: 'google',
        enabled: true,
        display_name: 'Google',
        icon_url: 'https://example.com/google.svg',
        client_id: 'test-google-client-id',
        client_secret: 'test-google-client-secret',
        email_conflict_strategy: 'auto_link',
      },
      {
        id: 'github-disabled',
        type: 'github',
        enabled: false,
        display_name: 'GitHub Disabled',
        icon_url: 'https://example.com/github-disabled.svg',
        client_id: 'test-github-disabled-client-id',
        client_secret: 'test-github-disabled-client-secret',
        email_conflict_strategy: 'auto_link',
      },
    ],
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
