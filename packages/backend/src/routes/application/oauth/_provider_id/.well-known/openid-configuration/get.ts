import z from 'zod/v4';
import { AppConfigs } from '@/lib/config.js';
import type { FastifyWithZodInstance } from '@/server.js';

/**
 * OpenID Provider Configuration Response Schema
 * Based on OpenID Connect Discovery 1.0 specification
 * https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderMetadata
 */
const OpenIDConfigurationResponse = z.object({
  // Required fields
  issuer: z
    .string()
    .describe('URL using the https scheme with no query or fragment component'),
  authorization_endpoint: z
    .string()
    .describe("URL of the OP's OAuth 2.0 Authorization Endpoint"),
  token_endpoint: z
    .string()
    .describe("URL of the OP's OAuth 2.0 Token Endpoint"),
  jwks_uri: z.string().describe("URL of the OP's JSON Web Key Set document"),
  response_types_supported: z
    .array(z.string())
    .describe(
      'JSON array containing a list of the OAuth 2.0 response_type values',
    ),
  subject_types_supported: z
    .array(z.string())
    .describe('JSON array containing a list of the Subject Identifier types'),
  id_token_signing_alg_values_supported: z
    .array(z.string())
    .describe(
      'JSON array containing a list of the JWS signing algorithms supported',
    ),

  // Recommended fields
  userinfo_endpoint: z
    .string()
    .optional()
    .describe("URL of the OP's UserInfo Endpoint"),
  scopes_supported: z
    .array(z.string())
    .optional()
    .describe('JSON array containing a list of the OAuth 2.0 scope values'),
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
    .describe('JSON array containing a list of Client Authentication methods'),
  code_challenge_methods_supported: z
    .array(z.string())
    .optional()
    .describe('JSON array containing a list of PKCE code challenge methods'),

  // Optional fields
  introspection_endpoint: z
    .string()
    .optional()
    .describe("URL of the OP's OAuth 2.0 Token Introspection Endpoint"),
  revocation_endpoint: z
    .string()
    .optional()
    .describe("URL of the OP's OAuth 2.0 Token Revocation Endpoint"),
  service_documentation: z
    .string()
    .optional()
    .describe('URL of a page containing human-readable information'),
  ui_locales_supported: z
    .array(z.string())
    .optional()
    .describe('Languages and scripts supported for the user interface'),
});

export default (fastify: FastifyWithZodInstance) => {
  return fastify.route({
    method: 'GET',
    url: '',
    schema: {
      summary: 'OpenID Provider Configuration',
      description:
        'Returns OpenID Provider Configuration Information (OpenID Connect Discovery 1.0)',
      tags: ['OpenID'],
      params: z.object({
        provider_id: z.string(),
      }),
      response: {
        200: OpenIDConfigurationResponse,
      },
    },
    handler: async (req, res) => {
      // Validate provider exists and is enabled
      const client = await fastify.oauthClientService.findByClientId(
        req.params.provider_id,
      );
      fastify.oauthClientService.validateEnabled(client);

      const baseUrl = AppConfigs.app.host;
      const oauthBasePath = `/application/oauth/${req.params.provider_id}`;

      // Build OpenID Configuration response
      // https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderMetadata
      const configuration = {
        // Required fields
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/application/oauth/authorize`,
        token_endpoint: `${baseUrl}/application/oauth/token`,
        jwks_uri: `${baseUrl}${oauthBasePath}/.well-known/jwks`,
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],

        // Recommended fields
        userinfo_endpoint: `${baseUrl}/application/oauth/userinfo`,
        scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
        claims_supported: [
          'sub',
          'iss',
          'aud',
          'exp',
          'iat',
          'nonce',
          'email',
          'email_verified',
          'name',
        ],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        token_endpoint_auth_methods_supported: [
          'client_secret_basic',
          'client_secret_post',
        ],
        code_challenge_methods_supported: ['S256', 'plain'],

        // Optional fields
        introspection_endpoint: `${baseUrl}/application/oauth/introspect`,
        revocation_endpoint: `${baseUrl}/application/oauth/revoke`,
        ui_locales_supported: AppConfigs.app.supported_languages,
      };

      // Set Cache-Control header for caching (1 hour)
      res.header('Cache-Control', 'public, max-age=3600');

      return res.status(200).send(configuration);
    },
  });
};
