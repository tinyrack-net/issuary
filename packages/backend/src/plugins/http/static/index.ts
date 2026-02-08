import fastifyPlugin from 'fastify-plugin';
import { env } from '@/lib/env.js';

/**
 * @description
 * Static file serving plugin.
 *
 * Delegates to environment-specific implementations:
 * - Development: Proxies to Vite dev server for HMR support
 * - Production/Test: Serves static files with SPA fallback
 *   and optional HTML variable interpolation
 */
export default fastifyPlugin(
  async (fastify) => {
    if (env.APP_ENV === 'development') {
      const { default: devPlugin } = await import('./dev.js');
      await fastify.register(devPlugin);
    } else {
      const { default: prodPlugin } = await import('./prod.js');
      await fastify.register(prodPlugin);
    }
  },
  { name: 'static-plugin' },
);
