import z from 'zod/v4';
import { OAuthClientEntity } from '@/entities/oauth-client.entity.js';
import { UserEntity } from '@/entities/user.entity.js';
import { AppConfigs } from '@/lib/config.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) => {
  return fastify.route({
    method: 'GET',
    url: '',
    schema: {
      summary: 'Authorize',
      description: 'OAuth2 Authorization Endpoint',
      tags: ['OpenID'],
      querystring: z.object({
        response_type: z
          .string()
          .min(1)
          .max(100)
          .describe(
            'OAuth2 response type (e.g., "code", "token"). Must be registered for this client.',
          ),
        redirect_uri: z
          .string()
          .min(1)
          .max(1000)
          .describe(
            'URI to redirect the user after authorization. Must exactly match one of the pre-registered redirect URIs for the client.',
          ),
        state: z
          .string()
          .min(1)
          .max(1000)
          .optional()
          .describe(
            'Opaque value used to maintain state between the request and callback. Recommended for CSRF protection. Will be returned unchanged in the redirect.',
          ),
        client_id: z
          .string()
          .min(1)
          .max(1000)
          .describe(
            'Unique identifier of the OAuth client application. Used to validate the client and verify allowed configurations.',
          ),
        code_challenge: z
          .string()
          .min(1)
          .max(1000)
          .optional()
          .describe(
            'PKCE code challenge derived from a code verifier. Used to prevent authorization code interception attacks. Recommended for public clients (SPAs, mobile apps).',
          ),
        code_challenge_method: z
          .enum(['S256', 'plain'])
          .optional()
          .default('S256')
          .describe(
            'Method used to derive the code challenge from the verifier. "S256" (SHA-256 hash, recommended) or "plain" (no transformation). Defaults to "S256".',
          ),
        scope: z
          .string()
          .min(1)
          .max(1000)
          .optional()
          .describe(
            'Space-delimited list of requested permission scopes (e.g., "openid profile email"). Each scope must be allowed for this client. Include "openid" for OIDC requests.',
          ),
        nonce: z
          .string()
          .min(1)
          .max(1000)
          .optional()
          .describe(
            'Random value used to mitigate replay attacks in OIDC flows. Will be included in the ID token for client verification.',
          ),
        prompt: z
          .enum(['none', 'login', 'consent', 'select_account'])
          .optional()
          .describe(
            'Controls authorization UI behavior. "none" (no UI, fail if interaction needed), "login" (force re-authentication), "consent" (show consent screen), "select_account" (account chooser).',
          ),
        max_age: z.coerce
          .number()
          .int()
          .min(0)
          .optional()
          .describe(
            "Maximum authentication age in seconds. If the user's last authentication is older than this value, re-authentication will be required.",
          ),
        display: z
          .enum(['page', 'popup', 'touch', 'wap'])
          .optional()
          .describe(
            'How the authorization server should display the authentication UI. "page" (full page), "popup" (popup window), "touch" (touch-optimized), "wap" (WAP device).',
          ),
      }),
      response: {
        302: z.null(),
        400: z.object({
          error: z.string(),
          error_description: z.string(),
        }),
      },
    },
    handler: async (req, res) => {
      const { query } = req;
      const em = fastify.mikro.orm.em.fork();

      // Helper function to redirect with error
      const redirectWithError = (
        error: string,
        errorDescription: string,
        redirectUri?: string,
      ) => {
        if (!redirectUri) {
          return res.status(400).send({
            error,
            error_description: errorDescription,
          });
        }

        const url = new URL(redirectUri);
        url.searchParams.set('error', error);
        url.searchParams.set('error_description', errorDescription);
        if (query.state) {
          url.searchParams.set('state', query.state);
        }

        return res.redirect(url.toString());
      };

      try {
        // 1. Validate and fetch OAuth client
        const client = await em.findOne(OAuthClientEntity, {
          clientId: query.client_id,
        });

        if (!client) {
          return redirectWithError(
            'unauthorized_client',
            'Client not found',
            query.redirect_uri,
          );
        }

        if (!client.enabled) {
          return redirectWithError(
            'unauthorized_client',
            'Client is disabled',
            query.redirect_uri,
          );
        }

        // 2. Validate redirect_uri
        if (!client.redirectUris.includes(query.redirect_uri)) {
          return redirectWithError(
            'invalid_request',
            'Invalid redirect_uri',
            undefined, // Don't redirect to invalid URI
          );
        }

        // 3. Validate response_type
        if (!client.responseTypes.includes(query.response_type)) {
          return redirectWithError(
            'unsupported_response_type',
            `Response type '${query.response_type}' is not allowed for this client`,
            query.redirect_uri,
          );
        }

        // 4. Validate and parse scope
        const requestedScopes = query.scope ? query.scope.split(' ') : [];
        const invalidScopes = requestedScopes.filter(
          (scope) => !client.scopes.includes(scope),
        );

        if (invalidScopes.length > 0) {
          return redirectWithError(
            'invalid_scope',
            `Invalid scopes: ${invalidScopes.join(', ')}`,
            query.redirect_uri,
          );
        }

        // OIDC: Check for 'openid' scope if present
        const _isOIDC = requestedScopes.includes('openid');

        // 5. Validate PKCE
        if (query.code_challenge) {
          if (
            query.code_challenge_method !== 'S256' &&
            query.code_challenge_method !== 'plain'
          ) {
            return redirectWithError(
              'invalid_request',
              'Invalid code_challenge_method. Must be S256 or plain',
              query.redirect_uri,
            );
          }
        }

        // 6. Check user session
        const userSession = req.session.get('user');

        if (!userSession?.id) {
          // User not logged in - redirect to login page with current params
          const loginUrl = new URL('/login', AppConfigs.app.host);
          loginUrl.searchParams.set('client_id', query.client_id);
          loginUrl.searchParams.set('redirect_uri', query.redirect_uri);
          loginUrl.searchParams.set('response_type', query.response_type);
          if (query.scope) {
            loginUrl.searchParams.set('scope', query.scope);
          }
          if (query.state) {
            loginUrl.searchParams.set('state', query.state);
          }
          if (query.nonce) {
            loginUrl.searchParams.set('nonce', query.nonce);
          }
          if (query.code_challenge) {
            loginUrl.searchParams.set('code_challenge', query.code_challenge);
          }
          if (query.code_challenge_method) {
            loginUrl.searchParams.set(
              'code_challenge_method',
              query.code_challenge_method,
            );
          }
          if (query.prompt) {
            loginUrl.searchParams.set('prompt', query.prompt);
          }
          if (query.max_age !== undefined) {
            loginUrl.searchParams.set('max_age', query.max_age.toString());
          }
          if (query.display) {
            loginUrl.searchParams.set('display', query.display);
          }

          return res.redirect(loginUrl.toString());
        }

        // 7. User is logged in - Issue authorization code
        // Fetch user entity for code generation
        const user = await em.findOneOrFail(UserEntity, {
          id: userSession.id,
        });

        // Generate authorization code
        const codeParams: {
          client: OAuthClientEntity;
          user: UserEntity;
          redirectUri: string;
          scope: string[];
          nonce?: string;
          codeChallenge?: string;
          codeChallengeMethod?: 'S256' | 'plain';
        } = {
          client,
          user,
          redirectUri: query.redirect_uri,
          scope: requestedScopes,
        };

        if (query.nonce) {
          codeParams.nonce = query.nonce;
        }
        if (query.code_challenge) {
          codeParams.codeChallenge = query.code_challenge;
        }
        if (query.code_challenge_method) {
          codeParams.codeChallengeMethod = query.code_challenge_method;
        }

        const { code } =
          await fastify.mikro.oauthCode.generateAuthorizationCode(codeParams);

        // Redirect back to client with authorization code
        const callbackUrl = new URL(query.redirect_uri);
        callbackUrl.searchParams.set('code', code);
        if (query.state) {
          callbackUrl.searchParams.set('state', query.state);
        }

        return res.redirect(callbackUrl.toString());
      } catch (error) {
        fastify.log.error(error);
        return redirectWithError(
          'server_error',
          'An unexpected error occurred',
          query.redirect_uri,
        );
      }
    },
  });
};
