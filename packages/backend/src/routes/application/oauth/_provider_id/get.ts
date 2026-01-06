import z from 'zod';
import { validateProvider } from '@/handlers/validate-provider.js';
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
      const provider = await validateProvider(req.params.provider_id);
      console.log(req.params.provider_id);
      res.status(200).send({
        ok: true,
      });
    },
  });
};
