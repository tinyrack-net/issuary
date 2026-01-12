import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

/**
 * GET /api/v1/user/totp
 *
 * Get TOTP status for the current user.
 * Returns whether TOTP two-factor authentication is enabled.
 */
export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'GET',
    url: '',
    schema: {
      summary: 'Get TOTP Status',
      description:
        'Check if TOTP two-factor authentication is enabled for the current user.',
      tags: [TAGS.USER],
      response: {
        200: r.TotpStatusResponse,
        401: e.Unauthorized.Schema,
      },
    },
    handler: async (req, res) => {
      const userSession = await req.auth.verify();

      const enabled = await fastify.totpService.isEnabled(userSession.id);

      return res.status(200).send({ enabled });
    },
  });
