import type { StandaloneConfigInput } from '@tinyauth/standalone/config';
import {
  E2E_TEST_CLIENT_CONFIG,
  E2E_TEST_USER_CONFIG,
} from '../fixtures/index.js';

/**
 * Creates a minimal backend configuration for e2e tests.
 * Standard password auth, no 2FA, in-memory database.
 */
export function createMinimalConfig(
  backendPort: number,
  frontendPort: number,
): StandaloneConfigInput {
  return {
    app: {
      host: `http://localhost:${backendPort}`,
      port: backendPort,
      cookie_secret:
        '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b',
      allowed_signup_emails: ['*'],
      frontend: {
        enabled: true,
        mode: 'proxy',
        path: `http://localhost:${frontendPort}`,
      },
    },
    logging: {
      level: 'silent',
      format: 'json',
    },
    database: {
      type: 'sqlite',
      test: true,
    },
    users: [E2E_TEST_USER_CONFIG],
    clients: [E2E_TEST_CLIENT_CONFIG],
  };
}
