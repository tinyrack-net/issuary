import { test as base } from '@playwright/test';
import {
  createE2EServer,
  type E2EConfigResult,
} from '#frontend-e2e/setup/create-server.js';

type ConfigFactory = (
  backendPort: number,
  frontendPort: number,
) => E2EConfigResult;

/**
 * Creates a standardized Playwright fixture for an e2e scenario.
 * A backend server is started per worker and exposed through baseURL.
 */
export function createScenarioFixture(configFactory: ConfigFactory) {
  return base.extend<object, { serverPort: number }>({
    serverPort: [
      async ({ browserName: _browserName }, use) => {
        const server = await createE2EServer(configFactory);
        await use(server.backendPort);
        await server.teardown();
      },
      { scope: 'worker' },
    ],
    baseURL: async ({ serverPort }, use) => {
      await use(`http://localhost:${serverPort}`);
    },
  });
}
