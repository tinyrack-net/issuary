import type { TinyAuthConfigs } from '@tinyauth/backend/config';
import {
  E2E_BASE_APP_CONFIG,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.js';

/**
 * Creates an account-deletion-disabled backend configuration for e2e tests.
 */
export function createAccountDeletionDisabledConfig(
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
        '44d4e6f8a0b2c4d6e8f0112233445566778899aabbccddeeff00112233445566',
      allowed_signup_emails: ['*'],
      account_deletion: false,
    },
  };
}
