import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
  if (!fastify.config.basic_authentication_methods.passkey.enabled) {
    return;
  }
  fastify.route({
    method: 'PATCH',
    url: '',
    schema: {
      summary: 'Rename Passkey',
      description: 'Rename a passkey',
      tags: [TAGS.USER],
      params: z.object({
        id: z.uuid(),
      }),
      body: z.object({
        name: z.string().min(1).max(100),
      }),
      response: {
        200: r.SuccessResponse,
        400: e.PasskeyNotEnabled.Schema,
        401: e.Unauthorized.Schema,
        404: e.PasskeyNotFound.Schema,
      },
    },
    handler: async (req, res) => {
      const userSession = await req.auth.verify();

      // Rename passkey
      await fastify.passkeyService.renamePasskey(
        userSession.id,
        req.params.id,
        req.body.name,
      );

      return res.status(200).send({
        success: true,
      });
    },
  });
};
