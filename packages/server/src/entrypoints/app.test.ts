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
});

describe('createApp with React Router SSR', () => {
  let app: AppType;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      branding: {
        title: { en: 'English Identity', ko: '한국어 아이덴티티' },
        subtitle: { en: 'English subtitle', ko: '한국어 부제' },
        login_method_description: { en: 'Sign in', ko: '로그인하세요' },
      },
    });
    app = server.app;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('server-renders frontend routes with private caching', async () => {
    const res = await app.request('/login/password');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.text()).toContain('<html');
  });

  test('redirects unauthenticated admin documents through the route middleware', async () => {
    const res = await app.request('/admin');

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('/login');
  });

  test('uses request cookies for localized metadata and the initial theme', async () => {
    const res = await app.request('/login/password', {
      headers: {
        Cookie: 'issuary-language=ko; issuary-color-scheme=dark',
      },
    });
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain('<html data-theme="tinyrack-dark" lang="ko"');
    expect(html).toContain('<title>한국어 아이덴티티</title>');
    expect(html).toContain('한국어 부제');
  });

  test('serves fingerprinted frontend assets with immutable caching', async () => {
    const documentResponse = await app.request('/login/password');
    const html = await documentResponse.text();
    const match = html.match(/(?:href|src)="(\/assets\/[^"]+)"/);
    const assetPath = match?.[1];
    if (!assetPath) {
      throw new Error('Expected the SSR document to reference an asset');
    }

    const assetResponse = await app.request(assetPath);
    expect(assetResponse.status).toBe(200);
    expect(assetResponse.headers.get('cache-control')).toBe(
      'public, max-age=31536000, immutable',
    );
  });

  test('returns a quiet 404 for a missing conventional favicon', async () => {
    const res = await app.request('/favicon.ico');

    expect(res.status).toBe(404);
    expect(await res.text()).toBe('');
  });

  test('keeps unmatched backend namespaces as JSON 404 responses', async () => {
    for (const path of ['/api/missing', '/oauth/missing']) {
      const res = await app.request(path);
      expect(res.status).toBe(404);
      await expect(res.json()).resolves.toEqual({ error: 'Not Found' });
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
    const client = testClient(app);
    const res = await client.api.health.$get(
      {},
      { headers: { Origin: 'https://app.example.test' } },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'https://app.example.test',
    );
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });

  test('does not allow a different origin', async () => {
    const client = testClient(app);
    const res = await client.api.health.$get(
      {},
      { headers: { Origin: 'https://evil.example.test' } },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  test('credentialed CORS never returns wildcard ACAO', async () => {
    const client = testClient(app);
    const res = await client.api.health.$get(
      {},
      { headers: { Origin: 'https://app.example.test' } },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).not.toBe('*');
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });
});
