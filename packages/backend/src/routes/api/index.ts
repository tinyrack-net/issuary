import { Hono } from 'hono';
import type { AppEnv } from '#backend/lib/app-env.js';
import { authRoutes } from './auth/index.js';
import { configRoutes } from './config/index.js';
import { consentRoutes } from './consent/index.js';
import { docsRoutes } from './docs/index.js';
import { healthRoutes } from './health/index.js';
import { oauthRoutes } from './oauth/index.js';
import { termsRoutes } from './terms/index.js';
import { userRoutes } from './user/index.js';

export const apiRoutes = new Hono<AppEnv>()
  .route('/', authRoutes)
  .route('/', configRoutes)
  .route('/', consentRoutes)
  .route('/', docsRoutes)
  .route('/', healthRoutes)
  .route('/', termsRoutes)
  .route('/', userRoutes)
  .route('/', oauthRoutes);
