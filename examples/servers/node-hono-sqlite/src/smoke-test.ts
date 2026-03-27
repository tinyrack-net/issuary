import assert from 'node:assert/strict';
import { createServer as createNetServer } from 'node:net';
import { serve } from '@hono/node-server';
import { createNodeHonoSqliteExampleApp } from './app.ts';

const port = await new Promise<number>((resolve, reject) => {
  const probe = createNetServer();
  probe.listen(0, '127.0.0.1', () => {
    const address = probe.address();
    if (!address || typeof address === 'string') {
      probe.close(() => reject(new Error('Failed to resolve a free port')));
      return;
    }
    probe.close((err) => (err ? reject(err) : resolve(address.port)));
  });
  probe.on('error', reject);
});

const baseUrl = `http://127.0.0.1:${port}`;
const { app, cleanup } = await createNodeHonoSqliteExampleApp({
  test: true,
  publicOrigin: baseUrl,
});

const server = await new Promise<ReturnType<typeof serve>>((resolve) => {
  const instance = serve(
    { fetch: app.fetch, port, hostname: '127.0.0.1' },
    () => resolve(instance),
  );
});

try {
  const frontendResponse = await fetch(`${baseUrl}/`);
  assert.equal(frontendResponse.status, 200);
  assert.match(
    frontendResponse.headers.get('content-type') ?? '',
    /text\/html/i,
  );

  const frontendHtml = await frontendResponse.text();
  assert.match(frontendHtml, /TinyAuth Hono Example/);
  assert.match(frontendHtml, /TinyAuth running in library mode/);
  assert.ok(!frontendHtml.includes('{{TITLE}}'));

  const discoveryResponse = await fetch(
    `${baseUrl}/oauth/.well-known/openid-configuration`,
  );
  assert.equal(discoveryResponse.status, 200);

  const discoveryBody = await discoveryResponse.json();
  assert.equal(typeof discoveryBody, 'object');
  assert.notEqual(discoveryBody, null);

  const issuer = 'issuer' in discoveryBody ? discoveryBody.issuer : undefined;
  const authorizationEndpoint =
    'authorization_endpoint' in discoveryBody
      ? discoveryBody.authorization_endpoint
      : undefined;

  assert.equal(issuer, baseUrl);
  assert.equal(authorizationEndpoint, `${baseUrl}/oauth/authorize`);

  const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: {
      'accept-language': 'en',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: 'alice@example.com',
      password: 'example-password-123',
    }),
  });
  assert.equal(registerResponse.status, 200);
  assert.match(registerResponse.headers.get('set-cookie') ?? '', /session=/);

  const registerBody = await registerResponse.text();
  assert.match(registerBody, /"email":"alice@example.com"/);
  assert.match(registerBody, /"email_verification_required":false/);
} finally {
  server.close();
  await cleanup();
}
