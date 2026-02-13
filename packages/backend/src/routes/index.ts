import type { FastifyInstance } from 'fastify';
import { registerWellKnownRoutes } from './.well-known/index.js';
import { registerApiV1Routes } from './api/v1/index.js';
import { registerOAuthRoutes } from './application/oauth/index.js';

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(registerApiV1Routes, {
    prefix: '/api/v1',
  });
  await fastify.register(registerOAuthRoutes, {
    prefix: '/application/oauth',
  });
  await fastify.register(registerWellKnownRoutes, {
    prefix: '/.well-known',
  });
}
