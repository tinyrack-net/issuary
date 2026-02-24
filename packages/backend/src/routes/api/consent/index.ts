import { Hono } from 'hono';
import type { AppEnv } from '#backend/lib/app-env.js';
import { consentGet } from './get.js';
import { consentPost } from './post.js';

export const consentRoutes = new Hono<AppEnv>()
  .route('/', consentGet)
  .route('/', consentPost);
