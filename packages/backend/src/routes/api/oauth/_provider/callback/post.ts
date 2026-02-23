import type { AppEnv } from '@backend/lib/app-env.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { verifyAuth, verifyOAuth } from '@backend/middleware/auth.js';
import { e } from '@backend/schemas/error.js';
import { f } from '@backend/schemas/field.js';
import { r } from '@backend/schemas/response.js';
import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';

export const oauthProviderCallbackPost = new Hono<AppEnv>().post(
  '/oauth/:provider/callback',
  describeRoute({
    tags: [TAGS.OAUTH_CONNECT],
    summary: 'OAuth Callback (POST)',
    description:
      'Handles the form_post callback from OAuth providers like Apple',
    responses: {
      302: {
        description: 'Redirect',
      },
      200: {
        content: {
          'application/json': {
            schema: resolver(r.OAuthCallbackResponse),
          },
        },
        description: 'Success',
      },
      400: {
        content: {
          'application/json': {
            schema: resolver(e.OAuthStateMismatch.Schema),
          },
        },
        description: 'State mismatch, session expired, or invalid request',
      },
      403: {
        content: {
          'application/json': {
            schema: resolver(e.OAuthEmailNotVerified.Schema),
          },
        },
        description: 'Email not verified or registration email not allowed',
      },
      404: {
        content: {
          'application/json': {
            schema: resolver(e.OAuthProviderNotFound.Schema),
          },
        },
        description: 'OAuth provider not found',
      },
      409: {
        content: {
          'application/json': {
            schema: resolver(e.OAuthEmailConflict.Schema),
          },
        },
        description: 'Email conflict or account already linked',
      },
      502: {
        content: {
          'application/json': {
            schema: resolver(e.OAuthTokenExchangeFailed.Schema),
          },
        },
        description: 'Token exchange failed or user info failed',
      },
    },
  }),
  validator(
    'param',
    z.object({
      provider: f.providerName,
    }),
  ),
  validator(
    'form',
    z.object({
      code: f.authorizationCode.optional(),
      state: f.state.optional(),
      error: z.string().optional(),
      error_description: z.string().optional(),
    }),
  ),
  verifyAuth({ optional: true }),
  verifyOAuth({ optional: true }),
  async (c) => {
    const { provider } = c.req.valid('param');
    const { code, state, error, error_description } = c.req.valid('form');
    const { session } = c.var;
    const { config, oauthConnectService } = c.var.services;
    const oauthSession = c.var.verifiedOAuth;

    // Handle OAuth error response
    if (error) {
      const errorUrl = new URL('/login', config.app.host);
      errorUrl.searchParams.set('oauth_error', error);
      if (error_description) {
        errorUrl.searchParams.set('oauth_error_description', error_description);
      }
      if (oauthSession?.returnUrl) {
        errorUrl.searchParams.set('redirect', oauthSession.returnUrl);
      }
      session.set('oauth', undefined);
      return c.redirect(errorUrl.toString());
    }

    // Validate required parameters
    if (!code || !state) {
      throw new e.OAuthInvalidRequest.Error();
    }

    if (!oauthSession) {
      throw new e.OAuthSessionExpired.Error();
    }

    const result = await oauthConnectService.processOAuthCallback({
      provider,
      code,
      state,
      oauthSession,
      userSub: c.var.verifiedUser?.user.sub,
      requestUrl: c.req.url,
    });

    // Clear OAuth session for all outcomes
    session.set('oauth', undefined);

    switch (result.action) {
      case 'error_redirect':
        return c.redirect(result.url);
      case 'link_complete':
        return c.redirect(result.returnUrl);
      case 'terms_redirect':
        return c.redirect(result.url);
      case 'login_terms_redirect':
        session.setUserSession(result.userSub);
        return c.redirect(result.termsUrl);
      case 'login_complete':
        session.setUserSession(result.userSub);
        return c.redirect(result.returnUrl || '/profile');
    }
  },
);
