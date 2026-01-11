import z from 'zod';
import { e } from '@/schemas/error.js';
import { r } from '@/schemas/response.js';
import type { FastifyWithZodInstance } from '@/server.js';

export default (fastify: FastifyWithZodInstance) =>
  fastify.route({
    method: 'GET',
    url: '',
    schema: {
      summary: 'OAuth Callback',
      description:
        'Handles the callback from OAuth provider after user authorization',
      tags: ['OAuth Connect'],
      params: z.object({
        provider: z.string().min(1),
      }),
      querystring: z.object({
        code: z.string().min(1),
        state: z.string().min(1),
        error: z.string().optional(),
        error_description: z.string().optional(),
      }),
      response: {
        302: z.void(),
        200: z.object({
          user: r.UserSession,
          is_new_user: z.boolean(),
          return_url: z.string().optional(),
        }),
        400: z.union([
          e.OAuthStateMismatch.Schema,
          e.OAuthSessionExpired.Schema,
        ]),
        404: e.OAuthProviderNotFound.Schema,
        409: z.union([
          e.OAuthEmailConflict.Schema,
          e.OAuthAccountAlreadyLinked.Schema,
        ]),
        502: z.union([
          e.OAuthTokenExchangeFailed.Schema,
          e.OAuthUserInfoFailed.Schema,
        ]),
      },
    },
    handler: async (req, res) => {
      const { provider } = req.params;
      const { code, state, error, error_description } = req.query;

      // Handle OAuth error response
      if (error) {
        // OAuth provider returned an error
        const errorUrl = new URL('/login', req.headers.referer || '/');
        errorUrl.searchParams.set('error', error);
        if (error_description) {
          errorUrl.searchParams.set('error_description', error_description);
        }
        return res.redirect(errorUrl.toString());
      }

      // Retrieve OAuth session data
      const oauthSession = req.session.get('oauth');

      if (!oauthSession) {
        throw new e.OAuthSessionExpired.Error();
      }

      // Validate state parameter
      if (oauthSession.state !== state) {
        throw new e.OAuthStateMismatch.Error();
      }

      // Validate provider matches
      if (oauthSession.providerName !== provider) {
        throw new e.OAuthProviderNotFound.Error();
      }

      // Exchange code for tokens
      const tokens = await fastify.oauthConnectService.exchangeCodeForTokens(
        provider,
        code,
        oauthSession.codeVerifier,
      );

      // Fetch user info from provider
      const userInfo = await fastify.oauthConnectService.fetchUserInfo(
        provider,
        tokens.access_token,
      );

      // Handle based on mode
      if (oauthSession.mode === 'link') {
        // Link mode: link OAuth account to existing user
        const userSession = req.session.get('user');
        if (!userSession) {
          throw new e.Unauthorized.Error();
        }

        await fastify.oauthConnectService.linkOAuthAccount(
          userSession.id,
          provider,
          tokens,
          userInfo,
        );

        // Clear OAuth session
        req.session.set('oauth', undefined);

        // Redirect to return URL or profile
        const returnUrl = oauthSession.returnUrl || '/profile';
        return res.redirect(returnUrl);
      }

      // Login/Register mode: authenticate with OAuth
      const result = await fastify.oauthConnectService.authenticateWithOAuth(
        provider,
        tokens,
        userInfo,
      );

      // Set user session
      req.session.set('user', { id: result.user.id });

      // Clear OAuth session
      req.session.set('oauth', undefined);

      // If return URL is provided, redirect
      if (oauthSession.returnUrl) {
        return res.redirect(oauthSession.returnUrl);
      }

      // Default: redirect to profile page
      return res.redirect('/profile');
    },
  });
