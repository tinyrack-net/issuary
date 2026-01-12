import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import type { FastifyWithZodInstance } from '@/server.js';

const PasskeyInfo = z.object({
  id: z.string(),
  credential_id: z.string(),
  name: z.string().nullable(),
  device_type: z.enum(['singleDevice', 'multiDevice']),
  backed_up: z.boolean(),
  created_at: z.date(),
});

export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'GET',
    url: '',
    schema: {
      summary: 'Get Passkeys',
      description: 'Get all passkeys for the current user',
      tags: [TAGS.USER],
      response: {
        200: z.object({
          passkeys: z.array(PasskeyInfo),
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
