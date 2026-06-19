import { test as base } from '@playwright/test';
import {
  createE2EServer,
  type E2EConfigResult,
} from '#frontend-e2e/setup/create-server.ts';

type ConfigFactory = (
  backendPort: number,
  frontendPort: number,
  auxiliaryPort: number,
) => E2EConfigResult;

type ServerInfo = {
  backendPort: number;
  auxiliaryPort: number;
  releaseAuxiliaryPort: () => Promise<void>;
  teardown: () => Promise<void>;
};

/**
 * Creates a standardized Playwright fixture for an e2e scenario.
 * A backend server is started per worker and exposed through baseURL.
 */
export function createScenarioFixture(configFactory: ConfigFactory) {
  return base.extend<
    object,
    {
      serverInfo: ServerInfo;
      serverPort: number;
      auxiliaryPort: number;
      releaseAuxiliaryPort: () => Promise<void>;
    }
  >({
    serverInfo: [
      async ({ browserName: _browserName }, use) => {
        const server = await createE2EServer(configFactory);
        await use({
          backendPort: server.backendPort,
          auxiliaryPort: server.auxiliaryPort,
          releaseAuxiliaryPort: server.releaseAuxiliaryPort,
          teardown: server.teardown,
        });
        await server.teardown();
      },
      { scope: 'worker' },
    ],
    serverPort: [
      async ({ serverInfo }, use) => {
        await use(serverInfo.backendPort);
      },
      { scope: 'worker' },
    ],
    auxiliaryPort: [
      async ({ serverInfo }, use) => {
        await use(serverInfo.auxiliaryPort);
      },
      { scope: 'worker' },
    ],
    releaseAuxiliaryPort: [
      async ({ serverInfo }, use) => {
        await use(serverInfo.releaseAuxiliaryPort);
      },
      { scope: 'worker' },
    ],
    baseURL: async ({ serverPort }, use) => {
      await use(`http://localhost:${serverPort}`);
    },
  });
}
