import { test as base, type Page, type Response } from '@playwright/test';
import {
  createE2EServer,
  type E2EConfigResult,
} from '#frontend-e2e/setup/create-server.ts';

type ConfigFactory = (
  backendPort: number,
  frontendPort: number,
  auxiliaryPort: number,
) => E2EConfigResult;

function isFirefoxNavigationAbort(error: unknown): boolean {
  const message = String(error instanceof Error ? error.message : error);
  return (
    message.includes('NS_BINDING_ABORTED') ||
    message.includes('NS_ERROR_FAILURE')
  );
}

export async function gotoWithFirefoxRetry(
  page: Page,
  browserName: string,
  url: string,
  options?: Parameters<Page['goto']>[1],
): Promise<Response | null> {
  const gotoOptions = { waitUntil: 'domcontentloaded' as const, ...options };
  try {
    return await page.goto(url, gotoOptions);
  } catch (error) {
    if (browserName !== 'firefox' || !isFirefoxNavigationAbort(error)) {
      throw error;
    }
  }

  await page
    .waitForLoadState('domcontentloaded', { timeout: 5_000 })
    .catch(() => undefined);

  try {
    return await page.goto(url, gotoOptions);
  } catch (retryError) {
    if (!isFirefoxNavigationAbort(retryError)) {
      throw retryError;
    }
    await page
      .waitForLoadState('domcontentloaded', { timeout: 5_000 })
      .catch(() => undefined);
    return null;
  }
}

type ServerInfo = {
  backendPort: number;
  auxiliaryPort: number;
  releaseAuxiliaryPort: () => Promise<void>;
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
        // Teardown is not handed to tests: the worker fixture owns the
        // server's lifetime, and a second caller disposing the ORM would take
        // the whole worker process down with it.
        await use({
          backendPort: server.backendPort,
          auxiliaryPort: server.auxiliaryPort,
          releaseAuxiliaryPort: server.releaseAuxiliaryPort,
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
