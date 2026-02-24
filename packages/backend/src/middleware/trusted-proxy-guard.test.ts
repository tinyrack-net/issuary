import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { trustedProxyGuard } from '#backend/middleware/trusted-proxy-guard.js';

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
  });
});
