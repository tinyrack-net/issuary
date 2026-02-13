import { createRoute } from '@hono/zod-openapi';
import z from 'zod/v4';
import { isEmailAllowed } from '@/lib/email-pattern.js';
import { TAGS } from '@/lib/swagger-tags.js';
import { ApiError, e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { AppType } from '@/types.js';

const route = createRoute({
  method: 'get',
  path: '/oauth/{provider}/callback',
  tags: [TAGS.OAUTH_CONNECT],
  summary: 'OAuth Callback',
  description:
    'Handles the callback from OAuth provider after user authorization',
  request: {
    params: z.object({
      provider: f.providerName,
    }),
    query: z.object({
      code: f.authorizationCode.optional(),
      state: f.state.optional(),
      error: z.string().optional(),
      error_description: z.string().optional(),
    }),
  },
  responses: {
    302: {
      description: 'Redirect',
    },
    200: {
      content: {
        'application/json': {
          schema: r.OAuthCallbackResponse,
        },
      },
      description: 'Success',
    },
    400: {
      content: {
        'application/json': {
          schema: e.OAuthStateMismatch.Schema,
        },
      },
      description: 'State mismatch, session expired, or invalid request',
    },
    403: {
      content: {
        'application/json': {
          schema: e.OAuthEmailNotVerified.Schema,
        },
      },
      description: 'Email not verified or registration email not allowed',
    },
    404: {
      content: {
        'application/json': {
          schema: e.OAuthProviderNotFound.Schema,
        },
      },
      description: 'OAuth provider not found',
    },
    409: {
      content: {
        'application/json': {
          schema: e.OAuthEmailConflict.Schema,
        },
      },
      description: 'Email conflict or account already linked',
    },
    502: {
      content: {
        'application/json': {
          schema: e.OAuthTokenExchangeFailed.Schema,
        },
      },
      description: 'Token exchange failed or user info failed',
    },
  },
});

export default (app: AppType) => {
  app.openapi(route, async (c) => {
    const params = c.req.valid('param');
    const query = c.req.valid('query');
    const { provider } = params;
    const { code, state, error, error_description } = query;
    const auth = c.get('auth');
    const session = c.get('session');
    const { config, oauthConnectService, termsService } = c.get('services');

    // Handle OAuth error response
    if (error) {
      const errorUrl = new URL('/login', config.app.host);
      errorUrl.searchParams.set('oauth_error', error);

      if (error_description) {
        errorUrl.searchParams.set('oauth_error_description', error_description);
      }

      const oauthSession = session.get('oauth');
      if (oauthSession?.returnUrl) {
        errorUrl.searchParams.set('redirect', oauthSession.returnUrl);
      }

      session.set('oauth', undefined);
      return c.redirect(errorUrl.toString());
    }

    // Validate required parameters for success flow
    if (!code || !state) {
      throw new e.OAuthInvalidRequest.Error();
    }

    // Retrieve OAuth session data
    const oauthSession = session.get('oauth');

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
    const tokens = await oauthConnectService.exchangeCodeForTokens(
      provider,
      code,
      oauthSession.codeVerifier,
    );

    // Fetch user info from provider
    const userInfo = await oauthConnectService.fetchUserInfo(
      provider,
      tokens.access_token,
    );

    // Handle based on mode
    if (oauthSession.mode === 'link') {
      // Link mode: link OAuth account to existing user
      const userSession = await auth.verify();

      await oauthConnectService.linkOAuthAccount(
        userSession.id,
        provider,
        tokens,
        userInfo,
      );

      // Clear OAuth session
      session.set('oauth', undefined);

      // Redirect to return URL or profile
      const returnUrl = oauthSession.returnUrl || '/profile';
      return c.redirect(returnUrl);
    }

    // Check if this would be a new user and if explicit terms exist
    const isNewUser = await oauthConnectService.isNewOAuthUser(
      provider,
      userInfo,
    );

    // For new users, check email allowlist before proceeding
    if (isNewUser) {
      const { allowed_signup_emails } = config.app;
      if (!isEmailAllowed(userInfo.email, allowed_signup_emails)) {
        const errorUrl = new URL('/login', config.app.host);
        errorUrl.searchParams.set(
          'oauth_error',
          'registration_email_not_allowed',
        );
        if (oauthSession.returnUrl) {
          errorUrl.searchParams.set('redirect', oauthSession.returnUrl);
        }
        session.set('oauth', undefined);
        return c.redirect(errorUrl.toString());
      }
    }

    // Load terms once and reuse
    const allTerms = await termsService.getGlobalTerms();
    const explicitTerms = await termsService.getExplicitTerms(allTerms);

    if (isNewUser && explicitTerms.length > 0) {
      // New user with explicit terms: store in session
      session.set('pendingOAuthRegistration', {
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
        expiresAt: Date.now() + 60 * 60 * 1000,
      });

      // Clear OAuth flow session
      session.set('oauth', undefined);

      // Redirect to terms page
      const termsUrl = new URL('/terms', `${config.app.host}`);
      termsUrl.searchParams.set('mode', 'complete_registration');
      if (oauthSession.returnUrl) {
        termsUrl.searchParams.set('redirect', oauthSession.returnUrl);
      }
      return c.redirect(termsUrl.toString());
    }

    // Login/Register mode: authenticate with OAuth
    try {
      const result = await oauthConnectService.authenticateWithOAuth(
        provider,
        tokens,
        userInfo,
      );

      // Set user session
      session.setUserSession(result.user.id);

      // Clear OAuth session
      session.set('oauth', undefined);

      // Check if existing user needs to see terms page
      if (!result.isNewUser && explicitTerms.length > 0) {
        const pendingTerms = await termsService.getPendingRequiredTerms(
          result.user.id,
        );
        const explicitTermIds = new Set(explicitTerms.map((t) => t.id));
        const shouldRedirectToTerms = pendingTerms.some((id) =>
          explicitTermIds.has(id),
        );

        if (shouldRedirectToTerms) {
          const url = new URL(c.req.url);
          const termsUrl = new URL('/terms', `${url.protocol}//${url.host}`);
          if (oauthSession.returnUrl) {
            termsUrl.searchParams.set('redirect', oauthSession.returnUrl);
          }
          return c.redirect(termsUrl.toString());
        }
      }

      // If return URL is provided, redirect
      if (oauthSession.returnUrl) {
        return c.redirect(oauthSession.returnUrl);
      }

      // Default: redirect to profile page
      return c.redirect('/profile');
    } catch (err) {
      // Catch RegistrationEmailNotAllowed and redirect to login
      if (
        err instanceof ApiError &&
        err.code === 'REGISTRATION_EMAIL_NOT_ALLOWED'
      ) {
        const errorUrl = new URL('/login', config.app.host);
        errorUrl.searchParams.set(
          'oauth_error',
          'registration_email_not_allowed',
        );
        if (oauthSession.returnUrl) {
          errorUrl.searchParams.set('redirect', oauthSession.returnUrl);
        }
        session.set('oauth', undefined);
        return c.redirect(errorUrl.toString());
      }
      throw err;
    }
  });
};
