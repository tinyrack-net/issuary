import { Hono } from 'hono';
import type { AppEnv } from '../lib/app-env.ts';
import { wellKnownRoutes } from './.well-known/index.ts';
import { apiRoutes } from './api/index.ts';
import { oauthApplicationRoutes } from './oauth/index.ts';

export const routes = new Hono<AppEnv>()
  .route('/api', apiRoutes)
  .route('/oauth', oauthApplicationRoutes)
  .route('/.well-known', wellKnownRoutes);
