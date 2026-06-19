import { Hono } from 'hono';
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
  async (c) => {
    const { config } = c.var.services;
    c.header('Cache-Control', 'public, max-age=3600');
    return c.json(buildOpenidConfiguration(config), 200);
  },
);
