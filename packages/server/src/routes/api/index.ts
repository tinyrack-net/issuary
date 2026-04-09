import { Hono } from 'hono';
import type { AppEnv } from '../../lib/app-env.ts';
import { authRoutes } from './auth/index.ts';
import { configRoutes } from './config/index.ts';
import { consentRoutes } from './consent/index.ts';
import { docsRoutes } from './docs/index.ts';
import { healthRoutes } from './health/index.ts';
import { oauthRoutes } from './oauth/index.ts';
import { termsRoutes } from './terms/index.ts';
import { userRoutes } from './user/index.ts';

export const apiRoutes = new Hono<AppEnv>()
  .route('/', authRoutes)
  .route('/', configRoutes)
  .route('/', consentRoutes)
  .route('/', docsRoutes)
  .route('/', healthRoutes)
  .route('/', termsRoutes)
  .route('/', userRoutes)
  .route('/', oauthRoutes);
