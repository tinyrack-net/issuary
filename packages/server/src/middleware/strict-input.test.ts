import { afterAll, beforeAll, expect, test } from 'vitest';
import { createTestApp, MINIMAL_TEST_CONFIG } from '../test-utils/setup.js';

let server: Awaited<ReturnType<typeof createTestApp>>;
beforeAll(async () => {
  server = await createTestApp(MINIMAL_TEST_CONFIG);
});
afterAll(async () => {
  await server.cleanup();
});
test.each([
  '{"email":"a@example.test","email":"b@example.test","password":"password123"}',
  '{"email":"a@example.test","\\u0065mail":"b@example.test","password":"password123"}',
])(
  'duplicate JSON identity is rejected before authentication: %s',
  async (body) => {
    const response = await server.app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
  },
);
test('duplicate OAuth query parameters cannot be resolved by first/last-value precedence', async () => {
  const response = await server.app.request(
    '/oauth/authorize?response_type=code&response_type=token&client_id=unknown&redirect_uri=https%3A%2F%2Fexample.test',
  );
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ error: 'invalid_request' });
});

test.each([undefined, '1'])(
  'streamed body limit is enforced with Content-Length %s',
  async (contentLength) => {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (contentLength) headers.set('Content-Length', contentLength);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(1048577));
        controller.close();
      },
    });
    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers,
      body: stream,
      ...{ duplex: 'half' },
    });
    const response = await server.app.request(request);
    expect(response.status).toBe(413);
  },
);
test('nested duplicate keys are rejected but separate objects may share keys', async () => {
  for (const body of ['{"a":{"b":1,"b":2}}', '{"a":1,"\\u0061":2}']) {
    expect(
      (
        await server.app.request('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
      ).status,
    ).toBe(400);
  }
});

test.each([
  'text/plain',
  'application/octet-stream',
  'application/x-www-form-urlencoded',
])('JSON login rejects mismatched Content-Type %s', async (contentType) => {
  const response = await server.app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body: '{"email":"absent@example.test","password":"password123"}',
  });
  expect(response.status).toBe(400);
});
test('malformed UTF-8 is rejected without replacement decoding', async () => {
  const response = await server.app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: new Uint8Array([0xff]),
  });
  expect(response.status).toBe(400);
});
