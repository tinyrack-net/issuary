import { Hono } from 'hono';
import type { AppEnv } from '#backend/lib/app-env.js';
import { termsConsentPost } from './consent/post.js';
import { termsGet } from './get.js';

export const termsRoutes = new Hono<AppEnv>()
  .route('/', termsGet)
  .route('/', termsConsentPost);
