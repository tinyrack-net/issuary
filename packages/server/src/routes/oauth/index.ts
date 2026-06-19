import { Hono } from 'hono';
import type { AppEnv } from '../../lib/app-env.ts';
import { jwksGet } from './.well-known/jwks/get.ts';
import { oidcConfigGet } from './.well-known/openid-configuration/get.ts';
import { authorizeGet } from './authorize/get.ts';
import { oauthCorsMiddleware } from './cors.js';
import { deviceGetPost } from './device/get-post.js';
import { deviceAuthorizationPost } from './device-authorization/post.js';
import { endSessionGet } from './end-session/get.js';
import { introspectPost } from './introspect/post.ts';
import { revokePost } from './revoke/post.ts';
import { tokenPost } from './token/post.ts';
import { userinfoGet } from './userinfo/get.ts';

export const oauthApplicationRoutes = new Hono<AppEnv>()
  .use('*', oauthCorsMiddleware)
  .route('/', authorizeGet)
  .route('/', deviceAuthorizationPost)
  .route('/', deviceGetPost)
  .route('/', endSessionGet)
  .route('/', tokenPost)
  .route('/', introspectPost)
  .route('/', revokePost)
  .route('/', userinfoGet)
  .route('/', jwksGet)
  .route('/', oidcConfigGet);
