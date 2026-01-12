import { r } from '@/schemas/response.js';
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
        app: fastify.config.app,
        database: {
          enabled: !!fastify.config.database?.type,
        },
        authentication_methods: fastify.config.authentication_methods,
      });
    },
  });
};
