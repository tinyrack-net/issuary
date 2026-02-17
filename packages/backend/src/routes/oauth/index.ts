import type { AppEnv } from '@backend/lib/app-env.js';
import { Hono } from 'hono';
import { jwksGet } from './.well-known/jwks/get.js';
import { oidcConfigGet } from './.well-known/openid-configuration/get.js';
import { authorizeGet } from './authorize/get.js';
import { introspectPost } from './introspect/post.js';
import { revokePost } from './revoke/post.js';
import { tokenPost } from './token/post.js';
import { userinfoGet } from './userinfo/get.js';

export const oauthApplicationRoutes = new Hono<AppEnv>()
  .route('/', authorizeGet)
  .route('/', tokenPost)
  .route('/', introspectPost)
  .route('/', revokePost)
  .route('/', userinfoGet)
  .route('/', jwksGet)
  .route('/', oidcConfigGet);
