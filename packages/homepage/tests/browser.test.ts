import { readFile, stat } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize } from 'node:path';

import { type Browser, chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const buildRoot = join(import.meta.dirname, '..', 'build', 'client');
let browser: Browser;
let origin: string;
let server: Server;

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

beforeAll(async () => {
  server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      const requestPath = decodeURIComponent(url.pathname);
      const relativePath = requestPath.endsWith('/')
        ? `${requestPath.slice(1)}index.html`
        : requestPath.slice(1);
      const path = normalize(join(buildRoot, relativePath));
      if (!path.startsWith(normalize(buildRoot)))
        throw new Error('Invalid path');
      const file = (await stat(path)).isDirectory()
        ? join(path, 'index.html')
        : path;
      const body = await readFile(file);
      response.writeHead(200, {
        'content-type':
          contentTypes[extname(file)] ?? 'application/octet-stream',
      });
      response.end(body);
    } catch {
      response.writeHead(404).end('Not found');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('No server port');
  }
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
  await new Promise<void>((resolve, reject) =>
    server?.close((error) => (error ? reject(error) : resolve())),
  );
}, 30_000);

describe('Tinyauth built documentation', () => {
  it('renders the reduced-motion English landing in desktop light mode', async () => {
    const page = await browser.newPage({
      colorScheme: 'light',
      reducedMotion: 'reduce',
    });
    await page.addInitScript(() =>
      localStorage.setItem('tinyrack-theme', 'tinyrack-light'),
    );
    await page.goto(`${origin}/en/`);
    await page.locator('html[data-hydrated="true"]').waitFor();

    await expect(
      page
        .getByRole('heading', { name: 'OIDC Provider for Homelab' })
        .isVisible(),
    ).resolves.toBe(true);
    await expect(
      page.getByText('OpenID Connect Provider', { exact: true }).isVisible(),
    ).resolves.toBe(true);
    await page.waitForTimeout(1_700);
    await expect(
      page.getByText('Homelab', { exact: true }).isVisible(),
    ).resolves.toBe(true);
    expect(await page.locator('html').getAttribute('data-theme')).toBe(
      'tinyrack-light',
    );
    await page.close();
  });

  it('renders Japanese docs and UI Callout in mobile dark mode', async () => {
    const page = await browser.newPage({
      colorScheme: 'dark',
      reducedMotion: 'reduce',
      viewport: { height: 844, width: 390 },
    });
    await page.addInitScript(() =>
      localStorage.setItem('tinyrack-theme', 'tinyrack-dark'),
    );
    await page.goto(`${origin}/ja/configuration/authentication/passkey/`);
    await page.locator('html[data-hydrated="true"]').waitFor();

    await expect(
      page.getByRole('heading', { exact: true, name: 'パスキー' }).isVisible(),
    ).resolves.toBe(true);
    await expect(
      page.locator('.tr-callout[data-variant="warning"]').isVisible(),
    ).resolves.toBe(true);
    expect(await page.locator('html').getAttribute('data-theme')).toBe(
      'tinyrack-dark',
    );
    await page.close();
  });

  it('hydrates Scalar against the generated OpenAPI document', async () => {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    const openApiResponse = page.waitForResponse((response) =>
      response.url().endsWith('/openapi.json'),
    );
    await page.goto(`${origin}/en/api-reference/`);
    await page.locator('html[data-hydrated="true"]').waitFor();
    await page.locator('[data-scalar-ready="true"]').waitFor();
    expect((await openApiResponse).status()).toBe(200);
    expect(errors.filter((error) => /hydration/iu.test(error))).toEqual([]);
    await page.close();
  });

  it('keeps the root redirect', async () => {
    const page = await browser.newPage();
    await page.goto(`${origin}/`);
    await page.waitForURL(`${origin}/en/`);
    await page.close();
  });
});
