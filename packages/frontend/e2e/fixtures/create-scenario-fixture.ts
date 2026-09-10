import {
  test as base,
  expect,
  type Page,
  type Request,
  type Response,
} from '@playwright/test';
import { isFirefoxNavigationAbort } from '#frontend/test-utils/is-firefox-navigation-abort.ts';
import {
  createE2EServer,
  type E2EConfigResult,
} from '#frontend-e2e/setup/create-server.ts';

type ConfigFactory = (
  backendPort: number,
  auxiliaryPort: number,
) => E2EConfigResult;

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
    launchOptions: async ({ launchOptions, browserName }, use) => {
      // The scenario server binds IPv4 only. Keep localhost as the origin for
      // WebAuthn, but avoid speculative IPv6 connections to an absent listener.
      await use(
        browserName === 'chromium'
          ? {
              ...launchOptions,
              args: [
                ...(launchOptions.args ?? []),
                '--host-resolver-rules=MAP localhost 127.0.0.1',
              ],
            }
          : launchOptions,
      );
    },
    page: async ({ page, baseURL }, use, testInfo) => {
      const scriptFailures: { path: string; error: string }[] = [];
      const onRequestFailed = (request: Request) => {
        const url = new URL(request.url());
        const error = request.failure()?.errorText;
        if (
          request.resourceType() === 'script' &&
          url.origin === baseURL &&
          error &&
          error !== 'net::ERR_ABORTED' &&
          error !== 'NS_BINDING_ABORTED'
        ) {
          scriptFailures.push({ path: url.pathname, error });
        }
      };
      page.on('requestfailed', onRequestFailed);
      try {
        await use(page);
      } finally {
        page.off('requestfailed', onRequestFailed);
        if (scriptFailures.length > 0) {
          await testInfo.attach('client-script-failures', {
            body: JSON.stringify(scriptFailures, null, 2),
            contentType: 'application/json',
          });
        }
        expect(
          scriptFailures,
          'Client JavaScript requests must succeed',
        ).toEqual([]);
      }
    },
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
