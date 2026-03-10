import type { TinyAuthConfigs } from '@tinyauth/backend/config';
import { E2E_BASE_APP_CONFIG, E2E_BASE_CONFIG } from '../fixtures/index.js';

/**
 * Creates a minimal backend configuration for e2e tests.
 * Standard password auth, no 2FA, in-memory database.
 */
export function createMinimalConfig(
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
  };
}
