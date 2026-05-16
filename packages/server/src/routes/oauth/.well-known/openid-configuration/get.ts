import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '#server/lib/app-env.js';
import { TAGS } from '#server/lib/swagger-tags.js';

export const oidcConfigGet = new Hono<AppEnv>().get(
  '/.well-known/openid-configuration',
  describeRoute({
    tags: [TAGS.OPENID],
    summary: 'OpenID Provider Configuration',
    description:
      'Returns OpenID Provider Configuration Information (OpenID Connect Discovery 1.0)',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(
              z.object({
                issuer: z
                  .string()
                  .describe(
                    'URL using the https scheme with no query or fragment component',
                  ),
                authorization_endpoint: z
                  .string()
                  .describe("URL of the OP's OAuth 2.0 Authorization Endpoint"),
                token_endpoint: z
                  .string()
                  .describe("URL of the OP's OAuth 2.0 Token Endpoint"),
                jwks_uri: z
                  .string()
                  .describe("URL of the OP's JSON Web Key Set document"),
                response_types_supported: z
                  .array(z.string())
                  .describe(
                    'JSON array containing a list of the OAuth 2.0 response_type values',
                  ),
                response_modes_supported: z
                  .array(z.string())
                  .optional()
                  .describe(
                    'JSON array containing a list of supported response_mode values',
                  ),
                subject_types_supported: z
                  .array(z.string())
                  .describe(
                    'JSON array containing a list of the Subject Identifier types',
                  ),
                id_token_signing_alg_values_supported: z
                  .array(z.string())
                  .describe(
                    'JSON array containing a list of the JWS signing algorithms supported',
                  ),
                userinfo_endpoint: z
                  .string()
                  .optional()
                  .describe("URL of the OP's UserInfo Endpoint"),
                scopes_supported: z
                  .array(z.string())
                  .optional()
                  .describe(
                    'JSON array containing a list of the OAuth 2.0 scope values',
                  ),
                claims_supported: z
                  .array(z.string())
                  .optional()
                  .describe('JSON array containing a list of the Claim Names'),
                grant_types_supported: z
                  .array(z.string())
                  .optional()
                  .describe(
                    'JSON array containing a list of the OAuth 2.0 Grant Type values',
                  ),
                token_endpoint_auth_methods_supported: z
                  .array(z.string())
                  .optional()
                  .describe(
                    'JSON array containing a list of Client Authentication methods',
                  ),
                code_challenge_methods_supported: z
                  .array(z.string())
                  .optional()
                  .describe(
                    'JSON array containing a list of PKCE code challenge methods',
                  ),
                introspection_endpoint: z
                  .string()
                  .optional()
                  .describe(
                    "URL of the OP's OAuth 2.0 Token Introspection Endpoint",
                  ),
                revocation_endpoint: z
                  .string()
                  .optional()
                  .describe(
                    "URL of the OP's OAuth 2.0 Token Revocation Endpoint",
                  ),
                service_documentation: z
                  .string()
                  .optional()
                  .describe(
                    'URL of a page containing human-readable information',
                  ),
                ui_locales_supported: z
                  .array(z.string())
                  .optional()
                  .describe(
                    'Languages and scripts supported for the user interface',
                  ),
                request_parameter_supported: z
                  .boolean()
                  .optional()
                  .describe('Whether request object by value is supported'),
                request_uri_parameter_supported: z
                  .boolean()
                  .optional()
                  .describe('Whether request object by reference is supported'),
                claims_parameter_supported: z
                  .boolean()
                  .optional()
                  .describe(
                    'Whether the claims request parameter is supported',
                  ),
              }),
            ),
          },
        },
        description: 'OpenID Configuration',
      },
    },
  }),
  async (c) => {
    const { config } = c.var.services;
    const baseUrl = config.server.public_origin;

    const configuration = {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      jwks_uri: `${baseUrl}/oauth/.well-known/jwks`,
      response_types_supported: ['code'],
      response_modes_supported: ['query'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      userinfo_endpoint: `${baseUrl}/oauth/userinfo`,
      scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
      claims_supported: [
        'sub',
        'iss',
        'aud',
        'exp',
        'iat',
        'nonce',
        'auth_time',
        'at_hash',
        'email',
        'email_verified',
        'name',
      ],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: [
        'client_secret_basic',
        'client_secret_post',
        'none',
      ],
      code_challenge_methods_supported: ['S256'],
      introspection_endpoint: `${baseUrl}/oauth/introspect`,
      revocation_endpoint: `${baseUrl}/oauth/revoke`,
      ui_locales_supported: config.i18n.supported_languages,
      request_parameter_supported: false,
      request_uri_parameter_supported: false,
      claims_parameter_supported: false,
    };

    // Set Cache-Control header
    c.header('Cache-Control', 'public, max-age=3600');

    return c.json(configuration, 200);
  },
);
