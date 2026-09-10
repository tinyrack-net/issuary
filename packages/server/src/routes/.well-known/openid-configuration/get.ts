import { Hono } from 'hono';
import { describeRoute } from 'hono-openapi';
import type { AppEnv } from '#server/lib/app-env.js';
import { buildOpenidConfiguration } from '#server/routes/oauth/.well-known/openid-configuration/get.js';

/**
 * Standard OIDC Discovery endpoint at /.well-known/openid-configuration
 * Serves direct JSON rather than redirecting for client compatibility.
 *
 * This provides compatibility with clients that expect the standard
 * OIDC Discovery URL at the root level.
 */
export const openidConfigGet = new Hono<AppEnv>().get(
  '/openid-configuration',
  describeRoute({
    summary: 'OpenID Connect discovery',
    responses: { 200: { description: 'Provider metadata' } },
  }),
  async (c) => {
    const { config } = c.var.services;
    c.header('Cache-Control', 'public, max-age=3600');
    if (c.req.header('origin')) {
      c.res.headers.delete('Access-Control-Allow-Credentials');
      c.header('Access-Control-Allow-Origin', '*');
    }
    return c.json(buildOpenidConfiguration(config), 200);
  },
);
