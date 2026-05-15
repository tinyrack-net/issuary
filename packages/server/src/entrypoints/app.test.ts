import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createTestApp, MINIMAL_TEST_CONFIG } from '../test-utils/index.ts';
import type { AppType } from './app.ts';

describe('createApp', () => {
  let app: AppType;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp(MINIMAL_TEST_CONFIG);
    app = server.app;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('serves backend routes normally', async () => {
    const client = testClient(app);
    const res = await client.api.health.$get();

    expect(res.status).toBe(200);
  });

  test('returns JSON 404 for frontend routes', async () => {
    const res = await app.request('/login');

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Not Found' });
  });
});

describe('createApp with frontend config', () => {
  let app: AppType;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      frontend: () => () => new Response('frontend', { status: 200 }),
    });
    app = server.app;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('delegates non-backend routes to frontend handler', async () => {
    const res = await app.request('/some-page');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('frontend');
  });

  test('delegates unmatched backend routes to frontend handler', async () => {
    for (const path of [
      '/api/missing',
      '/oauth/missing',
      '/.well-known/missing',
    ]) {
      const res = await app.request(path);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('frontend');
    }
  });

  test('still allows matched backend routes to work', async () => {
    const client = testClient(app);
    const res = await client.api.health.$get();
    expect(res.status).toBe(200);
  });
});

describe('createApp CORS policy', () => {
  let app: AppType;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      server: {
        public_origin: 'https://app.example.test',
      },
    });
    app = server.app;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('allows the configured public origin with credentials', async () => {
    const res = await app.request('/api/health', {
      headers: { Origin: 'https://app.example.test' },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'https://app.example.test',
    );
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });

  test('does not allow a different origin', async () => {
    const res = await app.request('/api/health', {
      headers: { Origin: 'https://evil.example.test' },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  test('credentialed CORS never returns wildcard ACAO', async () => {
    const res = await app.request('/api/health', {
      headers: { Origin: 'https://app.example.test' },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).not.toBe('*');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });
});
