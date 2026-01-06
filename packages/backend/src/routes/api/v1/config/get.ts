import z from 'zod';
import { AppConfigs } from '@/lib/config.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'GET',
    url: '',
    schema: {
      summary: 'Get App Config',
      description: 'Get App Config',
      tags: ['Config'],
      response: {
        200: z.object({
          database: z.object({
            enabled: z.boolean(),
          }),
        }),
      },
    },
    handler: async (_req, res) => {
      res.status(200).send({
        database: {
          enabled: !!AppConfigs.database?.enabled,
        },
      });
    },
  });
