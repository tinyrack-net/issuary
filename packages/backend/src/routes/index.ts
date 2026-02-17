import type { AppEnv } from '@backend/lib/app-env.js';
import { Hono } from 'hono';
import { wellKnownRoutes } from './.well-known/index.js';
import { apiRoutes } from './api/index.js';
import { oauthApplicationRoutes } from './oauth/index.js';

export const routes = new Hono<AppEnv>()
  .route('/api', apiRoutes)
  .route('/oauth', oauthApplicationRoutes)
  .route('/.well-known', wellKnownRoutes);
