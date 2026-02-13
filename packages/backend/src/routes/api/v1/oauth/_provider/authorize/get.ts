import { createRoute, z } from '@hono/zod-openapi';
import type { AppType } from '@/lib/app.js';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';

const route = createRoute({
  method: 'get',
  path: '/oauth/{provider}/authorize',
  tags: [TAGS.OAUTH_CONNECT],
  summary: 'Initiate OAuth Authorize Flow',
  description: 'Redirects the user to the OAuth provider for authentication',
  request: {
    params: z.object({
      provider: f.providerName,
    }),
    query: z.object({
      mode: f.oauthConnectMode.default('login'),
      return_url: f.returnUrl.optional(),
    }),
  },
  responses: {
    302: {
      description: 'Redirect to OAuth provider',
    },
    401: {
      content: {
        'application/json': {
          schema: e.Unauthorized.Schema,
        },
      },
      description: 'Unauthorized',
    },
    404: {
      content: {
        'application/json': {
          schema: e.OAuthProviderNotFound.Schema,
        },
      },
      description: 'OAuth provider not found',
    },
  },
});

export default (app: AppType) => {
  app.openapi(route, async (c) => {
    const params = c.req.valid('param');
    const query = c.req.valid('query');
    const { provider } = params;
    const { mode, return_url } = query;
    const auth = c.get('auth');
    const session = c.get('session');
    const { oauthConnectService } = c.get('services');

    // Link mode requires authenticated user
    if (mode === 'link') {
      await auth.verify();
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

    // Redirect to OAuth provider
    return c.redirect(url);
  });
};
