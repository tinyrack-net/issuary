import type { FastifyWithZodInstance } from '@/server.js';

/**
 * Standard OIDC Discovery endpoint at /.well-known/openid-configuration
 * Redirects to /application/oauth/.well-known/openid-configuration
 *
 * This provides compatibility with clients that expect the standard
 * OIDC Discovery URL at the root level.
 */
export default (fastify: FastifyWithZodInstance) => {
  return fastify.route({
    method: 'GET',
    url: '/openid-configuration',
    schema: {
      hide: true, // Hide from Swagger since it's a redirect
    },
    handler: async (_req, res) => {
      return res.redirect(
        '/application/oauth/.well-known/openid-configuration',
      );
    },
  });
};
