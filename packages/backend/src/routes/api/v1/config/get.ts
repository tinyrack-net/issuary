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
        app: {
          public_registration: fastify.config.app.public_registration,
          supported_languages: fastify.config.app.supported_languages,
          default_language: fastify.config.app.default_language,
          fallback_language: fastify.config.app.fallback_language,
          light_theme: fastify.config.app.light_theme,
          dark_theme: fastify.config.app.dark_theme,
          theme_mode: fastify.config.app.theme_mode,
          background_url: fastify.config.app.background_url,
        },
        database: {
          enabled: !!fastify.config.database?.type,
        },
        authentication_methods: fastify.config.authentication_methods,
      });
    },
  });
};
