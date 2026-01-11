import { r } from '@/schemas/response.js';
import { AppConfigs } from '@/lib/config.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
  fastify.route({
    method: 'GET',
    url: '',
    schema: {
      summary: 'Get App Config',
      description: 'Get App Config',
      tags: ['Config'],
      response: {
        200: r.ConfigResponse,
      },
    },
    handler: async (_req, res) => {
      res.status(200).send({
        app: AppConfigs.app,
        database: {
          enabled: !!AppConfigs.database?.type,
        },
        authentication_methods: AppConfigs.authentication_methods,
      });
    },
  });
};
