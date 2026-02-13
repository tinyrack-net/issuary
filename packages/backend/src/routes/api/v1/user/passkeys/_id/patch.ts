import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
  if (!fastify.config.auth.passkey.enabled) {
    return;
  }
  fastify.route({
    method: 'PATCH',
    url: '/user/passkeys/:id',
    schema: {
      summary: 'Rename Passkey',
      description: 'Rename a passkey',
      tags: [TAGS.USER],
      params: z.object({
        id: f.uuid,
      }),
      body: z.object({
        name: f.passkeyName,
      }),
      response: {
        200: r.OkResponse,
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
        ok: true,
      });
    },
  });
};
