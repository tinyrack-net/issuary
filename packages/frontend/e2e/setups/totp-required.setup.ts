import type { TestProject } from 'vitest/node';
import {
  createE2EServer,
  E2E_TEST_CLIENT,
  E2E_TEST_USER,
} from './shared.ts';

/**
 * Global setup for the "e2e:totp-required" project.
 *
 * Starts a backend server (port 18081) with TOTP-required
 * configuration and a Vite dev server (port 19081).
 *
 * Provides the backend URL to tests via `inject('backendUrl')`.
 */
export default async function setup(project: TestProject) {
  project.provide('backendUrl', 'http://localhost:18081');

  return createE2EServer({
    config: {
      app: {
        cookie_secret:
          '3e8a82a5d70bc32809c1757e06c3cccbc32f14dbbbded8d494983099cd84a92b',
        allowed_signup_emails: ['*'],
      },
      logging: {
        level: 'silent',
        format: 'json',
      },
      database: {
        type: 'memory',
      },
      smtp: {
        test: true,
      },
      users: [E2E_TEST_USER],
      clients: [E2E_TEST_CLIENT],
      auth: {
        password: {
          email_verification: false,
          second_factor: {
            required: true,
          },
          totp: {
            enabled: true,
          },
        },
      },
    },
    backendPort: 18081,
    frontendPort: 19081,
  });
}
