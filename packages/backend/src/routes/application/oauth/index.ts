import type { AppType } from '@/lib/app.js';
import { createRouter } from '@/lib/create-router.js';
import jwksGet from './.well-known/jwks/get.js';
import oidcConfigGet from './.well-known/openid-configuration/get.js';
import authorizeGet from './authorize/get.js';
import introspectPost from './introspect/post.js';
import revokePost from './revoke/post.js';
import tokenPost from './token/post.js';
import userinfoGet from './userinfo/get.js';

export function registerOAuthRoutes(parentApp: AppType): void {
  const app = createRouter();
  authorizeGet(app);
  tokenPost(app);
  introspectPost(app);
  revokePost(app);
  userinfoGet(app);
  jwksGet(app);
  oidcConfigGet(app);
  parentApp.route('/application/oauth', app);
}
