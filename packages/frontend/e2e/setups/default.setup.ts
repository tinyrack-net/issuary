import type { TestProject } from 'vitest/node';
import {
  createE2EServer,
  E2E_TEST_CLIENT,
  E2E_TEST_USER,
  MINIMAL_E2E_CONFIG,
} from './shared.ts';

/**
 * Global setup for the "e2e:default" project.
 *
 * Starts a backend server (port 18080) with default configuration
 * and a Vite dev server (port 19080) for the frontend.
 *
 * Provides the backend URL to tests via `inject('backendUrl')`.
 */
export default async function setup(project: TestProject) {
  project.provide('backendUrl', 'http://localhost:18080');

  return createE2EServer({
    config: {
      ...MINIMAL_E2E_CONFIG,
      users: [E2E_TEST_USER],
      clients: [E2E_TEST_CLIENT],
    },
    backendPort: 18080,
    vitePort: 19080,
  });
}
