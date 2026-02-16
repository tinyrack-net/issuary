import type { AppEnv } from '@backend/lib/app-env.js';
import { Hono } from 'hono';
import { consentGet } from './get.js';
import { consentPost } from './post.js';

export const consentRoutes = new Hono<AppEnv>()
  .route('/', consentGet)
  .route('/', consentPost);
