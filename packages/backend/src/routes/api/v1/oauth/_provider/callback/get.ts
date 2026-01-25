import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
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
      tags: [TAGS.OAUTH_CONNECT],
      params: z.object({
        provider: f.providerName,
      }),
      querystring: z.object({
        code: z.string().min(1).optional(),
        state: f.state.optional(),
        error: z.string().optional(),
        error_description: z.string().optional(),
      }),
      response: {
        302: z.void(),
        200: r.OAuthCallbackResponse,
        400: z.union([
          e.OAuthStateMismatch.Schema,
          e.OAuthSessionExpired.Schema,
          e.OAuthInvalidRequest.Schema,
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
        // Build redirect URL - use referer or construct from host header
        const baseUrl =
          req.headers.referer ||
          `${req.protocol}://${req.headers.host || 'localhost'}`;
        const errorUrl = new URL('/login', baseUrl);
        errorUrl.searchParams.set('error', error);
        if (error_description) {
          errorUrl.searchParams.set('error_description', error_description);
        }
        return res.redirect(errorUrl.toString());
      }

      // Validate required parameters for success flow
      if (!code || !state) {
        throw new e.OAuthInvalidRequest.Error();
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
      if (oauthSession.providerId !== provider) {
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
        const userSession = await req.auth.verify();

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

      // Check if this would be a new user and if explicit terms exist
      // For GDPR compliance, we defer user creation until terms consent is given
      const isNewUser = await fastify.oauthConnectService.isNewOAuthUser(
        provider,
        userInfo,
      );
      const explicitTerms = await fastify.termsService.getExplicitTerms();

      if (isNewUser && explicitTerms.length > 0) {
        // New user with explicit terms: store in session, don't create in DB yet
        // User will be created after terms consent on /terms page
        req.session.set('pendingOAuthRegistration', {
          providerId: provider,
          tokens: {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_in: tokens.expires_in,
            token_type: tokens.token_type,
          },
          userInfo: {
            id: userInfo.id,
            email: userInfo.email,
            email_verified: userInfo.email_verified,
            name: userInfo.name,
            picture: userInfo.picture,
          },
          returnUrl: oauthSession.returnUrl,
          expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
        });

        // Clear OAuth flow session
        req.session.set('oauth', undefined);

        // Redirect to terms page with mode indicating registration completion
        const termsUrl = new URL('/terms', `${fastify.config.app.host}`);
        termsUrl.searchParams.set('mode', 'complete_registration');
        if (oauthSession.returnUrl) {
          termsUrl.searchParams.set('redirect', oauthSession.returnUrl);
        }
        return res.redirect(termsUrl.toString());
      }

      // Login/Register mode: authenticate with OAuth
      // This handles: existing users, new users without explicit terms
      const result = await fastify.oauthConnectService.authenticateWithOAuth(
        provider,
        tokens,
        userInfo,
      );

      // Set user session
      req.setUserSession(result.user.id);

      // Clear OAuth session
      req.session.set('oauth', undefined);

      // Check if existing user needs to see terms page for pending required terms
      if (!result.isNewUser && explicitTerms.length > 0) {
        const pendingTerms = await fastify.termsService.getPendingRequiredTerms(
          result.user.id,
        );
        const explicitTermIds = new Set(explicitTerms.map((t) => t.id));
        const shouldRedirectToTerms = pendingTerms.some((id) =>
          explicitTermIds.has(id),
        );

        if (shouldRedirectToTerms) {
          const termsUrl = new URL(
            '/terms',
            `${req.protocol}://${req.headers.host}`,
          );
          if (oauthSession.returnUrl) {
            termsUrl.searchParams.set('redirect', oauthSession.returnUrl);
          }
          return res.redirect(termsUrl.toString());
        }
      }

      // If return URL is provided, redirect
      if (oauthSession.returnUrl) {
        return res.redirect(oauthSession.returnUrl);
      }

      // Default: redirect to profile page
      return res.redirect('/profile');
    },
  });
