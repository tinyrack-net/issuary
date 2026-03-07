import type { TinyAuthConfigs } from '@tinyauth/backend/config';
import { github } from '@tinyauth/backend/identity-providers/github';
import { google } from '@tinyauth/backend/identity-providers/google';
import {
  E2E_BASE_APP_CONFIG,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.js';

/**
 * Creates an oauth-providers backend configuration for e2e tests.
 */
export function createOauthProvidersConfig(
  backendPort: number,
  _frontendPort: number,
): TinyAuthConfigs {
  return {
    ...E2E_BASE_CONFIG,
    app: {
      ...E2E_BASE_APP_CONFIG,
      host: `http://localhost:${backendPort}`,
      port: backendPort,
      cookie_secret:
        '55d4e6f8a0b2c4d6e8f0112233445566778899aabbccddeeff00112233445566',
      allowed_signup_emails: ['*'],
    },
    identity_providers: [
      github({
        id: 'github',
        enabled: true,
        display_name: 'GitHub',
        icon_url: 'https://example.com/github.svg',
        client_id: 'test-github-client-id',
        client_secret: 'test-github-client-secret',
        email_conflict_strategy: 'auto_link',
      }),
      google({
        id: 'google',
        enabled: true,
        display_name: 'Google',
        icon_url: 'https://example.com/google.svg',
        client_id: 'test-google-client-id',
        client_secret: 'test-google-client-secret',
        email_conflict_strategy: 'auto_link',
      }),
      github({
        id: 'github-disabled',
        enabled: false,
        display_name: 'GitHub Disabled',
        icon_url: 'https://example.com/github-disabled.svg',
        client_id: 'test-github-disabled-client-id',
        client_secret: 'test-github-disabled-client-secret',
        email_conflict_strategy: 'auto_link',
      }),
    ],
  };
}
