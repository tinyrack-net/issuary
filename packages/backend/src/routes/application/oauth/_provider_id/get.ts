import z from 'zod';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
  return fastify.route({
    method: 'GET',
    url: '',
    schema: {
      summary: 'Issuer',
      description: 'OpenID Provider Issuer Information',
      tags: ['OpenID'],
      params: z.object({
        provider_id: z.string(),
      }),
      response: {
        200: z.object({
          ok: z.boolean(),
        }),
      },
    },
    handler: async (req, res) => {
      const client = await fastify.oauthClientService.findByClientId(
        req.params.provider_id,
      );
      fastify.oauthClientService.validateEnabled(client);

      res.status(200).send({
        ok: true,
      });
    },
  });
};
