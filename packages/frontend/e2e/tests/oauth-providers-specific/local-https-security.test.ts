import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import { expect, test } from '@playwright/test';
import {
  createTestConfig,
  E2E_BASE_CONFIG,
} from '#frontend-e2e/fixtures/index.ts';
import { createSpecificOauthProviders } from '#frontend-e2e/fragments/oauth-providers.ts';
import { createE2EServer } from '#frontend-e2e/setup/create-server.ts';

// A different hostname makes the provider's form POST cross-site, even on loopback.
test('local HTTPS cross-site Apple form_post keeps the bound session and rejects callback replay', async ({
  browser,
}) => {
  const directory = await mkdtemp(join(tmpdir(), 'issuary-https-'));
  const key = join(directory, 'key.pem');
  const cert = join(directory, 'cert.pem');
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      key,
      '-out',
      cert,
      '-days',
      '1',
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost,IP:127.0.0.1',
    ],
    { stdio: 'ignore' },
  );
  let fetchApp:
    | ((request: Request) => Response | Promise<Response>)
    | undefined;
  const https = serve({
    fetch: (request) =>
      fetchApp ? fetchApp(request) : new Response('Starting', { status: 503 }),
    createServer,
    serverOptions: { key: await readFile(key), cert: await readFile(cert) },
    hostname: '127.0.0.1',
    port: 0,
  });
  if (!https.listening) await once(https, 'listening');
  const address = https.address();
  if (!address || typeof address === 'string')
    throw new Error('Missing HTTPS address');
  const origin = `https://localhost:${address.port}`;
  const providerOrigin = `https://127.0.0.1:${address.port}`;
  const server = await createE2EServer((port) => ({
    ...E2E_BASE_CONFIG,
    ...createTestConfig(port, {
      server: { public_origin: origin },
      registration: {
        enabled: true,
        allowed_email_patterns: ['*@allowed.test'],
      },
    }),
    identity_providers: createSpecificOauthProviders(
      `http://localhost:${port}`,
    ).map((provider) => ({
      ...provider,
      authorization_url: provider.authorization_url.replace(
        `http://localhost:${port}`,
        providerOrigin,
      ),
    })),
  }));
  fetchApp = (request) => server.app.fetch(request);
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    const page = await context.newPage();
    await page.goto(`${origin}/login`);
    const callbackRequest = page.waitForRequest(
      (request) =>
        request.url().includes('/api/oauth/apple-stub/callback') &&
        request.method() === 'POST',
    );
    await page.getByRole('link', { name: 'Apple Stub', exact: true }).click();
    const callback = await callbackRequest;
    const callbackBody = callback.postData();
    const callbackCookies = (await callback.allHeaders())['cookie'];
    await expect(page).toHaveURL(`${origin}/profile`);
    await expect(
      page.getByText('oauth-apple-stub@allowed.test').first(),
    ).toBeVisible();
    expect(callbackBody).toBeTruthy();
    expect(callbackCookies).toContain('oauth_state=');
    const cookies = await context.cookies(origin);
    expect(cookies.find((cookie) => cookie.name === 'session')).toMatchObject({
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    });
    const session = await context.request.get(`${origin}/api/user/session`);
    expect(session.status()).toBe(200);
    expect(session.headers()['cache-control']).toBe('no-store');
    const profile = await context.request.get(`${origin}/profile`);
    expect(profile.headers()['cache-control']).toBe('no-store');
    const data = await context.request.get(`${origin}/profile.data`);
    expect(data.headers()['cache-control']).toBe('no-store');
    const replay = await context.request.post(
      `${origin}/api/oauth/apple-stub/callback`,
      {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        data: callbackBody ?? '',
        maxRedirects: 0,
      },
    );
    expect(replay.status()).toBe(400);
    expect(await replay.json()).toMatchObject({
      code: 'OAUTH_SESSION_EXPIRED',
    });
  } finally {
    await context.close();
    if ('closeAllConnections' in https) https.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      https.close((error) => (error ? reject(error) : resolve())),
    );
    await server.teardown();
    await rm(directory, { recursive: true, force: true });
  }
});
