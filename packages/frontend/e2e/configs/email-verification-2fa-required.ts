import {
  E2E_BASE_APP_CONFIG,
  E2E_BASE_AUTH_CONFIG,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.js';
import type { E2EConfigResult } from '#frontend-e2e/setup/create-server.js';

/**
 * Creates an email-verification + required 2FA backend configuration.
 * Both TOTP and passkey are enabled to test /verify/email continuation.
 */
export function createEmailVerification2faRequiredConfig(
  backendPort: number,
  _frontendPort: number,
): E2EConfigResult {
  return {
    ...E2E_BASE_CONFIG,
    app: {
      ...E2E_BASE_APP_CONFIG,
      host: `http://localhost:${backendPort}`,
      port: backendPort,
      allowed_signup_emails: ['*'],
      supported_languages: ['en'],
      default_language: 'en',
      fallback_language: 'en',
    },
    auth: {
      password: {
        ...E2E_BASE_AUTH_CONFIG.password,
        enabled: true,
        email_verification: true,
        second_factor: { required: true },
        totp: { enabled: true, issuer: 'TinyauthE2E' },
      },
      passkey: { ...E2E_BASE_AUTH_CONFIG.passkey, enabled: true },
    },
    mail: { test: true },
  };
}
