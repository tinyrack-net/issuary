import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import type { z } from 'zod';
import type { AppEnv } from '../../../lib/app-env.ts';
import type { TinyAuthRuntimeConfig } from '../../../lib/config/index.ts';
import { r } from '../../../schemas/response.ts';

type OAuthAuthenticationMethod = z.infer<typeof r.OAuthAuthenticationMethod>;
type ConfigResponse = z.infer<typeof r.ConfigResponse>;

const configResponseCache = new WeakMap<
  TinyAuthRuntimeConfig,
  ConfigResponse
>();

function buildConfigResponse(config: TinyAuthRuntimeConfig): ConfigResponse {
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

  return {
    i18n: {
      supported_languages: config.i18n.supported_languages,
      default_language: config.i18n.default_language,
      fallback_language: config.i18n.fallback_language,
    },
    branding: {
      light_theme: config.branding.light_theme,
      dark_theme: config.branding.dark_theme,
      theme_mode: config.branding.theme_mode,
      background_url: config.branding.background_url,
      icon_url: config.branding.icon_url,
      title: config.branding.title,
      subtitle: config.branding.subtitle,
    },
    registration: {
      public_registration: config.registration.enabled,
      email_pattern_filter_enabled:
        config.registration.allowed_email_patterns.length > 0,
      email_verification_required:
        config.registration.email_verification_required,
      signup_notice: config.registration.signup_notice,
    },
    database: {
      enabled: !!config.database,
    },
    email: {
      enabled: !!config.email,
    },
    admin: {
      enabled: config.admin.enabled,
    },
    auth: {
      password: config.auth.password,
      passkey: config.auth.passkey,
    },
    identity_providers: identityProviders,
    account_deletion: {
      enabled: config.account_deletion.enabled,
      retention: config.account_deletion.retention,
    },
  };
}

function getConfigResponse(config: TinyAuthRuntimeConfig): ConfigResponse {
  const cached = configResponseCache.get(config);
  if (cached) {
    return cached;
  }

  const response = buildConfigResponse(config);
  configResponseCache.set(config, response);
  return response;
}

export const configGet = new Hono<AppEnv>().get(
  '/config',
  describeRoute({
    tags: ['Config'],
    summary: 'Get App Config',
    description: 'Get App Config',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(r.ConfigResponse),
          },
        },
        description: 'Success',
      },
    },
  }),
  async (c) => {
    const { config } = c.var.services;

    return c.json(getConfigResponse(config), 200);
  },
);
