import type { FastifyInstance } from 'fastify';
import apiErrorHandlerPlugin from './api-error-handler.js';
import cookiePlugin from './cookie.js';
import corsPlugin from './cors.js';
import formbodyPlugin from './formbody.js';
import scalarPlugin from './scalar.js';
import secureSessionPlugin from './secure-session.js';
import staticPlugin from './static/index.js';
import swaggerPlugin from './swagger.js';
import trustedProxyGuardPlugin from './trusted-proxy-guard.js';

export async function registerHttpPlugins(
  fastify: FastifyInstance,
): Promise<void> {
  await fastify.register(corsPlugin);
  await fastify.register(cookiePlugin);
  await fastify.register(formbodyPlugin);
  await fastify.register(apiErrorHandlerPlugin);
  await fastify.register(trustedProxyGuardPlugin);
  await fastify.register(swaggerPlugin);
  await fastify.register(scalarPlugin);
  await fastify.register(secureSessionPlugin);
  await fastify.register(staticPlugin);
}
