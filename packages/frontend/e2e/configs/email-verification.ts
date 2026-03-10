import {
  E2E_BASE_APP_CONFIG,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.js';
import type { E2EConfigResult } from '#frontend-e2e/setup/create-server.js';

/**
 * Creates an email-verification backend configuration for e2e tests.
 * SMTP enabled so DB users require email verification.
 * No 2FA required -- isolates email verification testing.
 */
export function createEmailVerificationConfig(
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
    },
    mail: { test: true },
  };
}
