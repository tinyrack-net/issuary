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
      // Transform identity_providers array to response format
      // Only include enabled providers
      const identityProviders: OAuthAuthenticationMethod[] = [];

      for (const config of fastify.config.identity_providers) {
        if (!config.enabled) {
          continue;
        }
        const method: OAuthAuthenticationMethod = {
          id: config.id,
          type: config.type,
          display_name: config.display_name ?? config.id,
          icon_url: config.icon_url,
        };
        identityProviders.push(method);
      }

      res.status(200).send({
        app: {
          public_registration:
            fastify.config.app.allowed_signup_emails.length > 0,
          supported_languages: fastify.config.app.supported_languages,
          default_language: fastify.config.app.default_language,
          fallback_language: fastify.config.app.fallback_language,
          light_theme: fastify.config.app.light_theme,
          dark_theme: fastify.config.app.dark_theme,
          theme_mode: fastify.config.app.theme_mode,
          background_url: fastify.config.app.background_url,
          signup_implicit_terms: fastify.config.app.signup_implicit_terms,
          icon_url: fastify.config.app.icon_url,
          title: fastify.config.app.title,
          subtitle: fastify.config.app.subtitle,
        },
        database: {
          enabled: !!fastify.config.database?.type,
        },
        auth: fastify.config.auth,
        identity_providers: identityProviders,
        account_deletion: {
          enabled: fastify.config.app.account_deletion,
          retention_period: fastify.config.cleanup.deleted_users.retention,
        },
      });
    },
  });
};
