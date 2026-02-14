import { createRouter } from '@/lib/create-router.js';

/**
 * Standard OIDC Discovery endpoint at /.well-known/openid-configuration
 * Redirects to /application/oauth/.well-known/openid-configuration
 *
 * This provides compatibility with clients that expect the standard
 * OIDC Discovery URL at the root level.
 */
export default createRouter().get('/openid-configuration', async (c) => {
  return c.redirect('/application/oauth/.well-known/openid-configuration');
});
