import type { TinyAuthConfigs } from '@tinyauth/backend/config';
import {
  E2E_BASE_APP_CONFIG,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.js';

/**
 * Creates an account deletion backend configuration for e2e tests.
 * Enables account deletion so users can delete their accounts.
 */
export function createAccountDeletionConfig(
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
        'f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6b7a8f9e0d1c2b3a4f5e6d7c8b9a0f1e2',
      allowed_signup_emails: ['*'],
      account_deletion: true,
    },
  };
}
