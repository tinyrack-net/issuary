import { createRouter } from '@backend/lib/create-router.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { createRoute, z } from '@hono/zod-openapi';

const route = createRoute({
  method: 'get',
  path: '/.well-known/openid-configuration',
  tags: [TAGS.OPENID],
  summary: 'OpenID Provider Configuration',
  description:
    'Returns OpenID Provider Configuration Information (OpenID Connect Discovery 1.0)',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
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
              .describe("URL of the OP's OAuth 2.0 Token Revocation Endpoint"),
            service_documentation: z
              .string()
              .optional()
              .describe('URL of a page containing human-readable information'),
            ui_locales_supported: z
              .array(z.string())
              .optional()
              .describe(
                'Languages and scripts supported for the user interface',
              ),
          }),
        },
      },
      description: 'OpenID Configuration',
    },
  },
});

export default createRouter().openapi(route, async (c) => {
  const { config } = c.get('services');
  const baseUrl = config.app.host;

  const configuration = {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/application/oauth/authorize`,
    token_endpoint: `${baseUrl}/application/oauth/token`,
    jwks_uri: `${baseUrl}/application/oauth/.well-known/jwks`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
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
    introspection_endpoint: `${baseUrl}/application/oauth/introspect`,
    revocation_endpoint: `${baseUrl}/application/oauth/revoke`,
    ui_locales_supported: config.app.supported_languages,
  };

  // Set Cache-Control header
  c.header('Cache-Control', 'public, max-age=3600');

  return c.json(configuration, 200);
});
