import type { TinyAuthConfigs } from '@tinyauth/backend/config';
import {
  E2E_BASE_APP_CONFIG,
  E2E_BASE_AUTH_CONFIG,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.js';

/**
 * Creates a TOTP-optional configuration for e2e tests.
 */
export function createTotpOptionalConfig(
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
        '99d4e6f8a0b2c4d6e8f0112233445566778899aabbccddeeff00112233445566',
      allowed_signup_emails: ['*'],
      supported_languages: ['en'],
      default_language: 'en',
      fallback_language: 'en',
    },
    auth: {
      password: {
        ...E2E_BASE_AUTH_CONFIG.password,
        enabled: true,
        email_verification: false,
        second_factor: { required: false },
        totp: { enabled: true, issuer: 'TinyauthE2E' },
      },
      passkey: { ...E2E_BASE_AUTH_CONFIG.passkey, enabled: false },
    },
  };
}
