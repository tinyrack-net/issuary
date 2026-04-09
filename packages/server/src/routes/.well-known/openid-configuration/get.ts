import { Hono } from 'hono';
import type { AppEnv } from '#server/lib/app-env.js';

/**
 * Standard OIDC Discovery endpoint at /.well-known/openid-configuration
 * Redirects to /oauth/.well-known/openid-configuration
 *
 * This provides compatibility with clients that expect the standard
 * OIDC Discovery URL at the root level.
 */
export const openidConfigGet = new Hono<AppEnv>().get(
  '/openid-configuration',
  async (c) => {
    return c.redirect('/oauth/.well-known/openid-configuration');
  },
);
