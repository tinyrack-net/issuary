import type { TestProject } from 'vitest/node';
import { createE2EServer, E2E_TEST_CLIENT, E2E_TEST_USER } from './shared.ts';

/**
 * Global setup for the "e2e:default" project.
 *
 * Starts a backend server (port 18080) with default configuration
 * and a Vite dev server (port 19080) for the frontend.
 *
 * Provides the backend URL to tests via `inject('backendUrl')`.
 */
export default async function setup(project: TestProject) {
  const frontendPort = 19080;
  const backendPort = 18080;
  project.provide('backendUrl', `http://localhost:${backendPort}`);

  return createE2EServer({
    backendConfigs: {
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
    },
    backendPort: backendPort,
    frontendPort: frontendPort,
  });
}
