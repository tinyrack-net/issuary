import type { FastifyPluginAsync } from 'fastify';
import openidConfigGet from './openid-configuration/get.js';

export const registerWellKnownRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(openidConfigGet);
};
