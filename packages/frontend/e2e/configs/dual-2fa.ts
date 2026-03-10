import type { TinyAuthConfigs } from '@tinyauth/backend/config';
import {
  E2E_BASE_APP_CONFIG,
  E2E_BASE_AUTH_CONFIG,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.js';

/**
 * Creates a dual-2fa backend configuration for e2e tests.
 * Both TOTP and passkey are enabled and second factor is required.
 */
export function createDual2faConfig(
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
        enabled: true,
        email_verification: false,
        second_factor: { required: true },
        totp: { enabled: true, issuer: 'TinyauthE2E' },
      },
      passkey: { ...E2E_BASE_AUTH_CONFIG.passkey, enabled: true },
    },
  };
}
