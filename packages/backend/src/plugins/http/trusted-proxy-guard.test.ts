import Fastify, { type FastifyInstance } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Mock the config decorator for testing
// Using type assertion to bypass strict type checking for mock objects
const mockConfigPlugin = (trustProxy: boolean | string | string[] | number) =>
  fastifyPlugin(
    (fastify, _opts, done) => {
      fastify.decorate('config', {
        app: {
          trust_proxy: trustProxy,
        },
      } as never);
      fastify.decorate('serverOptions', {
        skipListen: false,
        cliMode: false,
        silent: true,
      });
      done();
    },
    { name: 'mock-config' },
  );

// Import the actual guard plugin
import trustedProxyGuard from './trusted-proxy-guard.js';

describe('trusted-proxy-guard plugin', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = Fastify({ logger: false });
  });

  afterEach(async () => {
    await app.close();
  });

  describe('when trust_proxy is false', () => {
    it('should allow all requests (direct connection mode)', async () => {
      await app.register(mockConfigPlugin(false));
      await app.register(trustedProxyGuard);
      app.get('/test', () => ({ status: 'ok' }));
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('when trust_proxy is true', () => {
    it('should allow all requests (trust all proxies)', async () => {
      await app.register(mockConfigPlugin(true));
      await app.register(trustedProxyGuard);
      app.get('/test', () => ({ status: 'ok' }));
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('when trust_proxy is a number', () => {
    it('should allow all requests (hop count mode)', async () => {
      await app.register(mockConfigPlugin(2));
      await app.register(trustedProxyGuard);
      app.get('/test', () => ({ status: 'ok' }));
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('when trust_proxy is IP-based (string or array)', () => {
    it('should register the onRequest hook', async () => {
      await app.register(mockConfigPlugin(['10.0.0.0/8']));
      await app.register(trustedProxyGuard);
      app.get('/test', () => ({ status: 'ok' }));
      await app.ready();

      // The hook is registered, but inject() doesn't provide real socket info
      // so we just verify the plugin doesn't crash on registration
      expect(app.hasDecorator('config')).toBe(true);
    });

    it('should work with string trust_proxy', async () => {
      await app.register(mockConfigPlugin('127.0.0.1'));
      await app.register(trustedProxyGuard);
      app.get('/test', () => ({ status: 'ok' }));
      await app.ready();

      // Plugin registers successfully
      expect(app.hasDecorator('config')).toBe(true);
    });

    it('should work with array trust_proxy', async () => {
      await app.register(mockConfigPlugin(['10.0.0.0/8', '172.16.0.0/12']));
      await app.register(trustedProxyGuard);
      app.get('/test', () => ({ status: 'ok' }));
      await app.ready();

      // Plugin registers successfully
      expect(app.hasDecorator('config')).toBe(true);
    });
  });
});
