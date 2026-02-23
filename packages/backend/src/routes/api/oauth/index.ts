import type { AppEnv } from '@backend/lib/app-env.js';
import { Hono } from 'hono';
import { oauthProviderAuthorizeGet } from './_provider/authorize/get.js';
import { oauthProviderCallbackGet } from './_provider/callback/get.js';
import { oauthProviderCallbackPost } from './_provider/callback/post.js';
import { oauthProviderDelete } from './_provider/delete.js';

export const oauthRoutes = new Hono<AppEnv>()
  .route('/', oauthProviderAuthorizeGet)
  .route('/', oauthProviderCallbackGet)
  .route('/', oauthProviderCallbackPost)
  .route('/', oauthProviderDelete);
