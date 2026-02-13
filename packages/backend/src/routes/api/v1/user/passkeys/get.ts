import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
  if (!fastify.config.auth.passkey.enabled) {
    return;
  }
  fastify.route({
    method: 'GET',
    url: '/user/passkeys',
    schema: {
      summary: 'Get Passkeys',
      description: 'Get all passkeys for the current user',
      tags: [TAGS.USER],
      response: {
        200: z.object({
          passkeys: z.array(r.PasskeyInfo),
        }),
        401: e.Unauthorized.Schema,
      },
    },
    handler: async (req, res) => {
      const userSession = await req.auth.verify();
      const passkeys = await fastify.passkeyService.getUserPasskeys(
        userSession.id,
      );

      return res.status(200).send({
        passkeys,
      });
    },
  });
};
