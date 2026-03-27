import { Hono } from 'hono';
import type { AppEnv } from '../../../lib/app-env.ts';
import { termsConsentPost } from './consent/post.ts';
import { termsGet } from './get.ts';

export const termsRoutes = new Hono<AppEnv>()
  .route('/', termsGet)
  .route('/', termsConsentPost);
