import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../../../lib/app-env.ts';
import { encrypt } from '../../../../../lib/crypto.ts';
import { OPENAPI_SECURITY } from '../../../../../lib/openapi.ts';
import { TAGS } from '../../../../../lib/swagger-tags.ts';
import { verifyAuth } from '../../../../../middleware/auth.ts';
import { e } from '../../../../../schemas/error.ts';
import { f } from '../../../../../schemas/field.ts';

export const oauthProviderAuthorizeGet = new Hono<AppEnv>().get(
  '/oauth/:provider/authorize',
  describeRoute({
    tags: [TAGS.OAUTH_CONNECT],
    security: OPENAPI_SECURITY.optionalCookieSession,
    summary: 'Initiate OAuth Authorize Flow',
    description: 'Redirects the user to the OAuth provider for authentication',
    responses: {
      302: {
        description: 'Redirect to OAuth provider',
      },
      401: {
        content: {
          'application/json': {
            schema: resolver(e.Unauthorized.Schema),
          },
        },
        description: 'Unauthorized',
      },
      404: {
        content: {
          'application/json': {
            schema: resolver(e.OAuthProviderNotFound.Schema),
          },
        },
        description: 'OAuth provider not found',
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
    'query',
    z.object({
      mode: f.oauthConnectMode.default('login'),
      return_url: f.returnUrl.optional(),
    }),
  ),
  verifyAuth({ optional: true }),
  async (c) => {
    const params = c.req.valid('param');
    const query = c.req.valid('query');
    const { provider } = params;
    const { mode, return_url } = query;
    const session = c.var.session;
    const { config, oauthConnectService } = c.var.services;

    // Link mode requires authenticated user
    if (mode === 'link') {
      if (!c.var.verifiedUser) {
        throw new e.Unauthorized.Error();
      }
    }

    // Generate authorization URL and session data
    const { url, sessionData } =
      await oauthConnectService.generateAuthorizationUrl(
        provider,
        mode,
        return_url,
      );

    // Store OAuth session data in secure session
    session.set('oauth', sessionData);

    const providerConfig = await oauthConnectService.getProvider(provider);
    if (providerConfig.response_mode === 'form_post') {
      setCookie(
        c,
        'oauth_state',
        await encrypt(
          JSON.stringify(sessionData),
          config.security.session_secret,
        ),
        {
          path: `/api/oauth/${provider}/callback`,
          httpOnly: true,
          secure: true,
          sameSite: 'None',
          maxAge: 600,
        },
      );
    }

    // Redirect to OAuth provider
    return c.redirect(url);
  },
);
