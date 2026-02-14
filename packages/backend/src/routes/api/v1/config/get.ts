import { createRouter } from '@backend/lib/create-router.js';
import { r } from '@backend/schemas/response.js';
import { createRoute, type z } from '@hono/zod-openapi';

type OAuthAuthenticationMethod = z.infer<typeof r.OAuthAuthenticationMethod>;

const route = createRoute({
  method: 'get',
  path: '/config',
  tags: ['Config'],
  summary: 'Get App Config',
  description: 'Get App Config',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: r.ConfigResponse,
        },
      },
      description: 'Success',
    },
  },
});

export const configGet = createRouter().openapi(route, async (c) => {
  const { config } = c.get('services');

  // Transform identity_providers array to response format
  // Only include enabled providers
  const identityProviders: OAuthAuthenticationMethod[] = [];

  for (const providerConfig of config.identity_providers) {
    if (!providerConfig.enabled) {
      continue;
    }
    const method: OAuthAuthenticationMethod = {
      id: providerConfig.id,
      type: providerConfig.type,
      display_name: providerConfig.display_name ?? providerConfig.id,
      icon_url: providerConfig.icon_url,
    };
    identityProviders.push(method);
  }

  return c.json(
    {
      app: {
        public_registration: config.app.allowed_signup_emails.length > 0,
        supported_languages: config.app.supported_languages,
        default_language: config.app.default_language,
        fallback_language: config.app.fallback_language,
        light_theme: config.app.light_theme,
        dark_theme: config.app.dark_theme,
        theme_mode: config.app.theme_mode,
        background_url: config.app.background_url,
        signup_implicit_terms: config.app.signup_implicit_terms,
        icon_url: config.app.icon_url,
        title: config.app.title,
        subtitle: config.app.subtitle,
      },
      database: {
        enabled: !!config.database?.type,
      },
      auth: config.auth,
      identity_providers: identityProviders,
      account_deletion: {
        enabled: config.app.account_deletion,
        retention_period: config.cleanup.deleted_users.retention,
      },
    },
    200,
  );
});
