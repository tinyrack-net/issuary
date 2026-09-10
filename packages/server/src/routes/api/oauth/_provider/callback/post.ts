import { Hono } from 'hono';
import { deleteCookie } from 'hono/cookie';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../../../lib/app-env.ts';
import { TAGS } from '../../../../../lib/swagger-tags.ts';
import { verifyAuth, verifyOAuth } from '../../../../../middleware/auth.ts';
import { e, IssuaryError } from '../../../../../schemas/error.ts';
import { f } from '../../../../../schemas/field.ts';
import { r } from '../../../../../schemas/response.ts';
import { withBrowserSecurity } from '../../../../../services/browser-security.service.js';
import { completeOAuthAuthentication } from '../../../../../services/oauth-browser-security.service.js';
import type { OAuthCallbackResult } from '../../../../../services/oauth-connect.service.ts';

const OAuthProviderCallbackFormBody = z
  .object({
    code: f.authorizationCode.optional(),
    state: f.state.optional(),
    error: z.string().optional(),
    error_description: z.string().optional(),
  })
  .describe('OAuth provider callback payload');

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
            schema: resolver(
              z.union([
                e.OAuthStateMismatch.Schema,
                e.OAuthInvalidRequest.Schema,
                e.OAuthSessionExpired.Schema,
              ]),
            ),
          },
        },
        description:
          'State mismatch, expired or revoked OAuth authentication, or invalid request',
      },
      401: {
        content: {
          'application/json': { schema: resolver(e.Unauthorized.Schema) },
        },
        description:
          'Browser session expired, revoked, or changed during authentication',
      },
      403: {
        content: {
          'application/json': {
            schema: resolver(
              z.union([
                e.OAuthEmailNotVerified.Schema,
                e.RegistrationEmailNotAllowed.Schema,
              ]),
            ),
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
            schema: resolver(
              z.union([
                e.OAuthEmailConflict.Schema,
                e.OAuthAccountAlreadyLinked.Schema,
                e.ConcurrentSecurityChange.Schema,
              ]),
            ),
          },
        },
        description:
          'Email conflict, account already linked, or concurrent security change',
      },
      502: {
        content: {
          'application/json': {
            schema: resolver(
              z.union([
                e.OAuthTokenExchangeFailed.Schema,
                e.OAuthUserInfoFailed.Schema,
              ]),
            ),
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
  validator('form', OAuthProviderCallbackFormBody),
  verifyAuth({ optional: true }),
  verifyOAuth({ optional: true }),
  async (c) => {
    const { provider } = c.req.valid('param');
    const { code, state, error, error_description } = c.req.valid('form');
    const { session } = c.var;
    const { config, oauthConnectService } = c.var.services;
    const oauthSession = c.var.verifiedOAuth;
    const oauthStateCookiePath = `/api/oauth/${provider}/callback`;

    // Handle OAuth error response
    if (error) {
      const errorUrl = new URL('/login', config.server.public_origin);
      errorUrl.searchParams.set('oauth_error', error);
      if (error_description) {
        errorUrl.searchParams.set('oauth_error_description', error_description);
      }
      if (oauthSession?.returnUrl) {
        errorUrl.searchParams.set('redirect', oauthSession.returnUrl);
      }
      session.set('oauth', undefined);
      deleteCookie(c, 'oauth_state', { path: oauthStateCookiePath });
      return c.redirect(errorUrl.toString());
    }

    // Validate required parameters
    if (!code || !state) {
      throw new e.OAuthInvalidRequest.Error();
    }

    if (!oauthSession) {
      throw new e.OAuthSessionExpired.Error();
    }

    let authenticationTransactionStarted = false;
    let authenticationCommitted = false;
    let result: OAuthCallbackResult;
    try {
      result = await oauthConnectService.processOAuthCallback({
        provider,
        code,
        state,
        oauthSession,
        userSub: c.var.verifiedUser?.user.sub,
        requestUrl: c.req.url,
        completeAuthentication: async (proof, operation) => {
          authenticationTransactionStarted = true;
          const completed = await completeOAuthAuthentication(
            c,
            proof,
            operation,
          );
          authenticationCommitted = true;
          return completed;
        },
        completeLink: (operation) =>
          withBrowserSecurity(c, async () => {
            await operation();
            session.set('oauth', undefined);
          }),
      });
    } catch (err) {
      if (!authenticationTransactionStarted) session.set('oauth', undefined);
      deleteCookie(c, 'oauth_state', { path: oauthStateCookiePath });
      if (err instanceof IssuaryError) {
        return c.json(err.toJson(), err.status);
      }
      throw err;
    }

    session.set('oauth', undefined);
    deleteCookie(c, 'oauth_state', { path: oauthStateCookiePath });

    switch (result.action) {
      case 'error_redirect':
        return c.redirect(result.url);
      case 'link_complete':
        return c.redirect(result.returnUrl);
      case 'terms_redirect':
        return c.redirect(result.url);
      case 'login_terms_redirect':
        if (!authenticationCommitted)
          session.setUserSession(result.userSub, result.userEpoch);
        return c.redirect(result.termsUrl);
      case 'login_complete':
        if (!authenticationCommitted)
          session.setUserSession(result.userSub, result.userEpoch);
        return c.redirect(result.returnUrl || '/profile');
    }
  },
);
