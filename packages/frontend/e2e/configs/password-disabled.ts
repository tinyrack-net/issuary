import type { TinyAuthConfigs } from '@tinyauth/backend/config';
import { google } from '@tinyauth/backend/identity-providers/google';
import {
  E2E_BASE_APP_CONFIG,
  E2E_BASE_AUTH_CONFIG,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.js';

/**
 * Creates a password-disabled backend configuration for e2e tests.
 * Password auth is disabled while passkey and OAuth login methods remain.
 */
export function createPasswordDisabledConfig(
  backendPort: number,
  _frontendPort: number,
): TinyAuthConfigs {
  return {
    ...E2E_BASE_CONFIG,
    app: {
      ...E2E_BASE_APP_CONFIG,
      host: `http://localhost:${backendPort}`,
      port: backendPort,
      allowed_signup_emails: ['*'],
    },
    auth: {
      password: {
        ...E2E_BASE_AUTH_CONFIG.password,
        enabled: false,
      },
      passkey: { ...E2E_BASE_AUTH_CONFIG.passkey, enabled: true },
    },
    identity_providers: [
      google({
        id: 'google',
        enabled: true,
        display_name: 'Google',
        client_id: 'test-google-client-id',
        client_secret: 'test-google-client-secret',
        email_conflict_strategy: 'auto_link',
      }),
    ],
  };
}
