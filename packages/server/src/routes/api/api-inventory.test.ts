import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { z } from 'zod';
import { TEST_USER_CONFIG } from '../../test-utils/fixtures.js';
import { createAuthenticatedSession } from '../../test-utils/helpers.js';
import { createTestApp, MINIMAL_TEST_CONFIG } from '../../test-utils/setup.js';

let server: Awaited<ReturnType<typeof createTestApp>>;
beforeAll(async () => {
  server = await createTestApp({
    ...MINIMAL_TEST_CONFIG,
    users: [{ ...TEST_USER_CONFIG, role: 'user' }],
    admin: { enabled: true },
  });
});
afterAll(async () => {
  await server.cleanup();
});
function endpoints() {
  return [
    ...new Set(
      server.app.routes
        .filter((route) => route.method !== 'ALL')
        .map((route) => `${route.method} ${route.path}`),
    ),
  ].sort();
}
test('every explicit runtime endpoint is in the audit and OpenAPI', async () => {
  const registered = endpoints();
  expect(registered).toHaveLength(81);
  const report = await readFile(
    new URL('../../../../../docs/security/api-audit.md', import.meta.url),
    'utf8',
  );
  const rows = [
    ...report.matchAll(/^\| `((?:GET|POST|PUT|PATCH|DELETE) [^`]+)` \|/gm),
  ]
    .map((match) => match[1])
    .sort();
  expect(rows).toEqual(registered);
  const response = await server.app.request('/api/docs/json');
  const spec = z
    .object({
      paths: z.record(
        z.string(),
        z.record(
          z.string(),
          z.looseObject({
            security: z
              .array(z.record(z.string(), z.array(z.string())))
              .optional(),
          }),
        ),
      ),
    })
    .parse(await response.json());
  for (const endpoint of registered) {
    const [method, path] = endpoint.split(' ');
    if (!method || !path) throw new Error('Invalid route');
    const documented =
      spec.paths[path.replace(/:([^/]+)/g, '{$1}')]?.[method.toLowerCase()];
    expect(documented, endpoint).toBeDefined();
    if (path.startsWith('/api/admin/'))
      expect(documented?.security, endpoint).toEqual([
        { cookieSessionAuth: [] },
      ]);
  }
});
test('all admin methods enforce anonymous and ordinary-user boundaries', async () => {
  const cookie = await createAuthenticatedSession(server.app);
  for (const endpoint of endpoints().filter((value) =>
    value.includes(' /api/admin/'),
  )) {
    const [method, path] = endpoint.split(' ');
    if (!method || !path) throw new Error('Invalid route');
    for (const [headers, status] of [
      [{}, 401],
      [{ Cookie: `session=${cookie}` }, 403],
    ] satisfies [HeadersInit, number][]) {
      const response = await server.app.request(
        path.replace(/:[^/]+/g, 'unknown'),
        { method, headers },
      );
      expect(response.status, `${endpoint}: ${status}`).toBe(status);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    }
  }
});
test('implicit HEAD and OPTIONS retain sensitive response and CORS policy', async () => {
  const head = await server.app.request('/api/user/session', {
    method: 'HEAD',
  });
  expect(head.status).toBe(200);
  expect(await head.text()).toBe('');
  expect(head.headers.get('Cache-Control')).toBe('no-store');
  const hostile = await server.app.request('/api/user/password', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://attacker.test',
      'Access-Control-Request-Method': 'PUT',
    },
  });
  expect(hostile.headers.get('Access-Control-Allow-Origin')).toBeNull();
});

test('fixed-seed malformed input corpus covers every registered method and path', async () => {
  let seed = 9700;
  const corpus = [
    '%00',
    '%FF',
    '%252e%252e',
    '%E2%80%AE',
    '%0d%0a',
    '%F0%9F%94%91',
  ];
  for (const endpoint of endpoints()) {
    const [method, template] = endpoint.split(' ');
    if (!method || !template) throw new Error('Invalid endpoint');
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const value = corpus[seed % corpus.length];
    const path = template.replace(/:[^/]+/g, value ?? '%00');
    const response = await server.app.request(`${path}?audit_input=${value}`, {
      method,
      ...(method === 'GET'
        ? {}
        : {
            headers: { 'Content-Type': 'application/json' },
            body: '{"audit":1,"audit":2}',
          }),
    });
    expect(response.status, endpoint).toBeLessThan(500);
    if (method !== 'GET') expect(response.status, endpoint).toBe(400);
  }
});
