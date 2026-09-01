import type { AddressInfo } from 'node:net';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { createServer as createViteServer } from 'vite';
import { AsyncCleanupStack } from '#frontend/test-utils/async-cleanup-stack.ts';
import {
  normalizeScreenDevArgs,
  resolveScreenDevMode,
} from '#frontend/test-utils/screen-dev-options.ts';
import { findScreenScenarioVariant } from '#frontend/test-utils/screen-scenario-catalog.ts';
import {
  findScreenScenario,
  screenScenarios,
} from '#frontend-e2e/screen-lab/catalog.ts';
import { createE2EServer } from '#frontend-e2e/setup/create-server.ts';

const SHARED_FRONTEND_PORT_ENV = 'E2E_SHARED_FRONTEND_PORT';
const HEADLESS_ENV = 'SCREEN_LAB_HEADLESS';
const EXIT_AFTER_READY_ENV = 'SCREEN_LAB_EXIT_AFTER_READY';
const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

function printScenarioList(): void {
  const longestId = Math.max(
    ...screenScenarios.map((scenario) => scenario.id.length),
  );
  for (const scenario of screenScenarios) {
    const variants = scenario.variants.map((variant) => variant.id).join(', ');
    process.stdout.write(
      `${scenario.id.padEnd(longestId)}  [${scenario.runtime}] ${scenario.title} — ${scenario.description}\n` +
        `${''.padEnd(longestId)}  variants: ${variants}\n`,
    );
  }
}

function printHelp(): void {
  process.stdout.write(
    'Open a Screen Lab scenario in a development browser.\n\n' +
      'Usage:\n' +
      '  pnpm screen:dev\n' +
      '  pnpm screen:dev --scenario <id> [--variant <id>]\n' +
      '  pnpm screen:dev --list\n\n' +
      'Options:\n' +
      '  -s, --scenario <id>  Screen scenario to open\n' +
      '  -v, --variant <id>   Scenario variant to open\n' +
      '  -l, --list           List available scenarios and variants\n' +
      '  -h, --help           Show this help\n',
  );
}

async function selectItem<T>(
  prompt: string,
  items: readonly T[],
  formatItem: (item: T) => string,
): Promise<T> {
  const input = createInterface({ input: process.stdin, output: process.stdout });
  try {
    process.stdout.write(`\n${prompt}\n`);
    for (const [index, item] of items.entries()) {
      process.stdout.write(`  ${index + 1}) ${formatItem(item)}\n`);
    }
    while (true) {
      const answer = await input.question('Choose a number: ');
      const selected = items[Number(answer) - 1];
      if (selected !== undefined) {
        return selected;
      }
      process.stdout.write(`Enter a number from 1 to ${items.length}.\n`);
    }
  } finally {
    input.close();
  }
}

function getPort(address: AddressInfo | string | null): number {
  if (typeof address === 'object' && address !== null) {
    return address.port;
  }
  throw new Error('Screen Lab could not resolve the Vite server port.');
}

function getBrowserLocale(locale: 'en' | 'ko' | 'ja'): string {
  if (locale === 'ko') {
    return 'ko-KR';
  }
  if (locale === 'ja') {
    return 'ja-JP';
  }
  return 'en-US';
}

const { values } = parseArgs({
  args: normalizeScreenDevArgs(process.argv.slice(2)),
  options: {
    help: { type: 'boolean', short: 'h', default: false },
    list: { type: 'boolean', short: 'l', default: false },
    scenario: { type: 'string', short: 's' },
    variant: { type: 'string', short: 'v' },
  },
  strict: true,
});

const mode = resolveScreenDevMode(values, process.stdin.isTTY === true);

if (mode.type === 'help') {
  printHelp();
  process.exit(0);
}

if (mode.type === 'list') {
  printScenarioList();
  process.exit(0);
}

if (mode.type === 'missing-scenario') {
  process.stderr.write(
    'Choose a scenario with --scenario <id>, inspect them with --list, or run this command in an interactive terminal.\n',
  );
  process.exit(1);
}

const interactiveScenario =
  mode.type === 'interactive'
    ? await selectItem(
        'Select a screen:',
        screenScenarios,
        (candidate) => `${candidate.id} — ${candidate.title}`,
      )
    : undefined;
const scenarioId =
  mode.type === 'run' ? mode.scenario : interactiveScenario?.id;
const scenario = scenarioId ? findScreenScenario(scenarioId) : undefined;
if (!scenario) {
  process.stderr.write(`Unknown Screen Lab scenario: ${scenarioId}\n\n`);
  printScenarioList();
  process.exit(1);
}

const interactiveVariant = interactiveScenario
  ? await selectItem(
      'Select a variant:',
      scenario.variants,
      (candidate) => candidate.id,
    )
  : undefined;
const variantId =
  mode.type === 'run' ? mode.variant : interactiveVariant?.id;
const variant = findScreenScenarioVariant(scenario, variantId);
if (!variant) {
  process.stderr.write(
    `Unknown variant for ${scenario.id}: ${variantId}\n` +
      `Available variants: ${scenario.variants
        .map((candidate) => candidate.id)
        .join(', ')}\n`,
  );
  process.exit(1);
}

const cleanups = new AsyncCleanupStack();
let primaryError: unknown;
let cleanupError: unknown;

try {
  const viteServer = await createViteServer({
    server: {
      host: '127.0.0.1',
      port: 0,
      strictPort: false,
    },
  });
  await viteServer.listen();
  cleanups.defer(() => viteServer.close());

  const frontendPort = getPort(viteServer.httpServer?.address() ?? null);
  const frontendOrigin = `http://127.0.0.1:${frontendPort}`;
  const previousFrontendPort = process.env[SHARED_FRONTEND_PORT_ENV];
  process.env[SHARED_FRONTEND_PORT_ENV] = String(frontendPort);
  cleanups.defer(() => {
    if (previousFrontendPort === undefined) {
      delete process.env[SHARED_FRONTEND_PORT_ENV];
      return;
    }
    process.env[SHARED_FRONTEND_PORT_ENV] = previousFrontendPort;
  });

  const backend =
    scenario.runtime === 'server'
      ? await createE2EServer(scenario.config)
      : undefined;
  if (backend) {
    cleanups.defer(() => backend.teardown());
  }

  const baseURL = backend
    ? `http://127.0.0.1:${backend.backendPort}`
    : frontendOrigin;
  const browser = await chromium.launch({
    headless: process.env[HEADLESS_ENV] === '1',
  });
  cleanups.defer(() => browser.close().catch(() => undefined));

  const context = await browser.newContext({
    baseURL,
    colorScheme: variant.colorScheme,
    locale: getBrowserLocale(variant.locale),
    viewport:
      variant.viewport === 'mobile' ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT,
  });
  const page = await context.newPage();
  await page.emulateMedia({
    colorScheme: variant.colorScheme,
    reducedMotion: 'reduce',
  });
  await page.addInitScript(
    ({ colorScheme, locale }) => {
      localStorage.setItem('issuary-color-scheme', colorScheme);
      localStorage.setItem('issuary-language', locale);
    },
    {
      colorScheme: variant.colorScheme,
      locale: variant.locale,
    },
  );

  if (scenario.runtime === 'route') {
    const url = new URL('/e2e/screen-lab/route-host.html', frontendOrigin);
    url.searchParams.set('scenario', scenario.id);
    url.searchParams.set('variant', variant.id);
    await page.goto(url.href);
  } else {
    await scenario.prepare({ baseURL, page, scenario });
  }

  await page
    .locator(scenario.readySelector)
    .first()
    .waitFor({ state: 'visible' });

  process.stdout.write(
    `Screen Lab opened "${scenario.title}" (${variant.id}) at ${page.url()}\n` +
      'Close the browser or press Ctrl+C to stop.\n',
  );

  if (process.env[EXIT_AFTER_READY_ENV] !== '1') {
    await new Promise<void>((resolve) => {
      let resolved = false;
      const finish = () => {
        if (resolved) {
          return;
        }
        resolved = true;
        resolve();
      };
      browser.once('disconnected', finish);
      process.once('SIGINT', finish);
      process.once('SIGTERM', finish);
      cleanups.defer(() => {
        browser.off('disconnected', finish);
        process.off('SIGINT', finish);
        process.off('SIGTERM', finish);
      });
    });
  }
} catch (error) {
  primaryError = error;
} finally {
  try {
    await cleanups.dispose();
  } catch (error) {
    cleanupError = error;
  }
}

if (primaryError !== undefined) {
  if (cleanupError !== undefined) {
    process.stderr.write(`Screen Lab cleanup error: ${String(cleanupError)}\n`);
  }
  throw primaryError;
}
if (cleanupError !== undefined) {
  throw cleanupError;
}
