import type { AppEnv } from '@backend/lib/app-env.js';
import { Hono } from 'hono';
import { authRoutes } from './auth/index.js';
import { configRoutes } from './config/index.js';
import { consentRoutes } from './consent/index.js';
import { healthRoutes } from './health/index.js';
import { oauthRoutes } from './oauth/index.js';
import { termsRoutes } from './terms/index.js';
import { userRoutes } from './user/index.js';

export const apiV1 = new Hono<AppEnv>()
  .route('/', authRoutes)
  .route('/', configRoutes)
  .route('/', consentRoutes)
  .route('/', healthRoutes)
  .route('/', termsRoutes)
  .route('/', userRoutes)
  .route('/', oauthRoutes);

export type ApiV1Type = typeof apiV1;
