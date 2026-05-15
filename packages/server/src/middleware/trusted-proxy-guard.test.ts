import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { TinyAuthError } from '../schemas/error.ts';
import { trustedProxyGuard } from './trusted-proxy-guard.ts';

/**
 * Tests for the trusted-proxy-guard Hono middleware.
 *
 * The middleware checks trust_proxy configuration and either:
 * - Passes through all requests (when trust_proxy is false/true/number)
 * - Filters by IP (when trust_proxy is string or array)
 *
 * In the test environment (app.request()), there is no real socket,
 * so IP-based filtering tests verify the middleware registers without
 * crashing and that the pass-through modes work correctly.
 */
describe('trusted-proxy-guard middleware', () => {
  describe('when trust_proxy is false', () => {
    it('should allow all requests (direct connection mode)', async () => {
      const app = new Hono();
      app.use('*', trustedProxyGuard(false));
      app.get('/test', (c) => c.json({ status: 'ok' }));

      const res = await app.request('/test');
      expect(res.status).toBe(200);
    });
  });

  describe('when trust_proxy is true', () => {
    it('should allow all requests (trust all proxies)', async () => {
      const app = new Hono();
      app.use('*', trustedProxyGuard(true));
      app.get('/test', (c) => c.json({ status: 'ok' }));

      const res = await app.request('/test');
      expect(res.status).toBe(200);
    });
  });

  describe('when trust_proxy is a number', () => {
    it('should allow all requests (hop count mode)', async () => {
      const app = new Hono();
      app.use('*', trustedProxyGuard(2));
      app.get('/test', (c) => c.json({ status: 'ok' }));

      const res = await app.request('/test');
      expect(res.status).toBe(200);
    });
  });

  describe('when trust_proxy is IP-based (string or array)', () => {
    it('should create middleware without crashing for array config', async () => {
      const middleware = trustedProxyGuard(['10.0.0.0/8']);
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should create middleware without crashing for string config', async () => {
      const middleware = trustedProxyGuard('127.0.0.1');
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should create middleware without crashing for multi-CIDR array', async () => {
      const middleware = trustedProxyGuard(['10.0.0.0/8', '172.16.0.0/12']);
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should allow requests from a trusted CIDR remote address', async () => {
      const app = new Hono();
      app.use('*', trustedProxyGuard(['10.0.0.0/8']));
      app.get('/test', (c) => c.json({ status: 'ok' }));

      const res = await app.request('/test', undefined, {
        connInfo: { remote: { address: '10.1.2.3' } },
      });

      expect(res.status).toBe(200);
    });

    it('should reject requests from an untrusted remote address even with spoofed forwarding headers', async () => {
      const app = new Hono();
      app.onError((err, c) => {
        if (err instanceof TinyAuthError) {
          return c.json(err.toJson(), err.status);
        }
        return c.json({ code: 'UNEXPECTED_ERROR' }, 500);
      });
      app.use('*', trustedProxyGuard(['10.0.0.0/8']));
      app.get('/test', (c) => c.json({ status: 'ok' }));

      const res = await app.request(
        '/test',
        {
          headers: {
            'X-Forwarded-For': '10.1.2.3',
            'X-Forwarded-Proto': 'https',
          },
        },
        { connInfo: { remote: { address: '203.0.113.9' } } },
      );

      expect(res.status).toBe(403);
      await expect(res.json()).resolves.toEqual({
        code: 'UNTRUSTED_PROXY',
        message: 'Request rejected: connection from untrusted source.',
      });
    });
  });
});
