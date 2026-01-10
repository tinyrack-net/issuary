import { AppConfigs } from '@/lib/config.js';
import type { FastifyWithZodInstance } from '@/server.js';
import z from 'zod';

export default (fastify: FastifyWithZodInstance) => {
  fastify.route({
    method: 'GET',
    url: '',
    schema: {
      summary: 'Get App Config',
      description: 'Get App Config',
      tags: ['Config'],
      response: {
        200: z.object({
          app: z.object({
            supported_languages: z.array(z.string()),
            default_language: z.string(),
            fallback_language: z.string(),
          }),
          database: z.object({
            enabled: z.boolean(),
          }),
          authentication_methods: z.record(
            z.string(),
            z.object({
              enabled: z.boolean(),
              type: z.string(),
            }),
          ),
        }),
      },
    },
    handler: async (_req, res) => {
      console.log(AppConfigs.authentication_methods);
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
