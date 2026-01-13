import type z from 'zod/v4';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

type OAuthAuthenticationMethod = z.infer<typeof r.OAuthAuthenticationMethod>;

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
      // Transform oauth_authentication_methods array to response format
      const oauthMethods: OAuthAuthenticationMethod[] = [];

      for (const config of fastify.config.oauth_authentication_methods) {
        const method: OAuthAuthenticationMethod = {
          id: config.id,
          type: config.type,
          enabled: config.enabled,
        };
        if (config.display_name !== undefined) {
          method.display_name = config.display_name;
        }
        if (config.icon_url !== undefined) {
          method.icon_url = config.icon_url;
        }
        oauthMethods.push(method);
      }

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
        basic_authentication_methods:
          fastify.config.basic_authentication_methods,
        oauth_authentication_methods: oauthMethods,
      });
    },
  });
};
