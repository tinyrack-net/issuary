import { Hono } from 'hono';
import type { AppEnv } from '../../../lib/app-env.ts';
import { consentGet } from './get.ts';
import { consentPost } from './post.ts';

export const consentRoutes = new Hono<AppEnv>()
  .route('/', consentGet)
  .route('/', consentPost);
