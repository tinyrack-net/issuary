import type { ResolvedAppConfig } from '@tinyauth/backend/config';
import {
  E2E_BASE_APP_CONFIG,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.js';

/**
 * Creates a registration-disabled backend configuration for e2e tests.
 * allowed_signup_emails is empty, so public registration is blocked.
 */
export function createRegistrationDisabledConfig(
  backendPort: number,
  _frontendPort: number,
): ResolvedAppConfig {
  return {
    ...E2E_BASE_CONFIG,
    app: {
      ...E2E_BASE_APP_CONFIG,
      host: `http://localhost:${backendPort}`,
      port: backendPort,
      cookie_secret:
        'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4',
      allowed_signup_emails: [],
    },
  };
}
