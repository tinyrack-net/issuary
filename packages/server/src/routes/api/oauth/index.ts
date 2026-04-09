import { Hono } from 'hono';
import type { AppEnv } from '../../../lib/app-env.ts';
import { oauthProviderAuthorizeGet } from './_provider/authorize/get.ts';
import { oauthProviderCallbackGet } from './_provider/callback/get.ts';
import { oauthProviderCallbackPost } from './_provider/callback/post.ts';
import { oauthProviderDelete } from './_provider/delete.ts';

export const oauthRoutes = new Hono<AppEnv>()
  .route('/', oauthProviderAuthorizeGet)
  .route('/', oauthProviderCallbackGet)
  .route('/', oauthProviderCallbackPost)
  .route('/', oauthProviderDelete);
