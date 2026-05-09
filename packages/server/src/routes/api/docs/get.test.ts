import { testClient } from 'hono/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { AppType } from '../../../entrypoints/app.ts';
import {
  assertJsonBody,
  createTestApp,
  MINIMAL_TEST_CONFIG,
} from '../../../test-utils/index.ts';

describe('OpenAPI docs when enabled', () => {
  let app: AppType;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
    });
    app = server.app;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  describe('GET /api/docs/json', () => {
    test('returns 200 with valid OpenAPI 3.1.0 JSON spec', async () => {
      const res = await app.request('/api/docs/json', {
        method: 'GET',
      });

      const body = await assertJsonBody(res);
      expect(body).toHaveProperty('openapi', '3.1.0');
      expect(body).toHaveProperty('info');
      expect(body.info).toHaveProperty('title', 'TinyAuth API');
      expect(body.info).toHaveProperty('version', '1.0.0');
      expect(body.info).toHaveProperty(
        'description',
        'OpenID Connect Provider API',
      );
    });

    test('includes paths in the spec', async () => {
      const res = await app.request('/api/docs/json', {
        method: 'GET',
      });

      const body = await assertJsonBody(res);
      expect(body).toHaveProperty('paths');
      expect(Object.keys(body.paths).length).toBeGreaterThan(0);
    });

    test('includes the health endpoint in paths', async () => {
      const res = await app.request('/api/docs/json', {
        method: 'GET',
      });

      const body = await assertJsonBody(res);
      expect(body.paths).toHaveProperty('/api/health');
    });

    test('includes security schemes for cookie and bearer auth', async () => {
      const res = await app.request('/api/docs/json', {
        method: 'GET',
      });

      const body = await assertJsonBody(res);
      expect(body.components).toBeDefined();
      expect(body.components.securitySchemes).toBeDefined();
      expect(body.components.securitySchemes).toHaveProperty(
        'cookieSessionAuth',
      );
      expect(body.components.securitySchemes).toHaveProperty('bearerAuth');
    });
  });

  describe('GET /api/docs', () => {
    test('returns 200 with Scalar API reference HTML', async () => {
      const client = testClient(app);
      const res = await client.api.docs.$get();

      expect(res.status).toBe(200);

      const contentType = res.headers.get('content-type');
      expect(contentType).toContain('text/html');
    });
  });
});

describe('OpenAPI docs with custom metadata', () => {
  let app: AppType;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      openapi: {
        title: 'Custom API',
        description: 'Custom API description',
        ui_title: 'Custom API Reference',
      },
    });
    app = server.app;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('uses configured title and description in the generated spec', async () => {
    const res = await app.request('/api/docs/json', {
      method: 'GET',
    });

    const body = await assertJsonBody(res);
    expect(body.info).toMatchObject({
      title: 'Custom API',
      description: 'Custom API description',
      version: '1.0.0',
    });
  });

  test('uses the configured UI title in the Scalar page', async () => {
    const res = await app.request('/api/docs', {
      method: 'GET',
    });

    expect(res.status).toBe(200);
    await expect(res.text()).resolves.toContain('Custom API Reference');
  });
});

describe('OpenAPI docs when disabled', () => {
  let app: AppType;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const server = await createTestApp({
      ...MINIMAL_TEST_CONFIG,
      openapi: {
        enabled: false,
      },
    });
    app = server.app;
    cleanup = server.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('returns 404 for GET /api/docs/json', async () => {
    const res = await app.request('/api/docs/json', {
      method: 'GET',
    });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Not Found' });
  });

  test('returns 404 for GET /api/docs', async () => {
    const client = testClient(app);
    const res = await client.api.docs.$get();

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Not Found' });
  });
});
