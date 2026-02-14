import { createRouter } from '@backend/lib/create-router.js';
import { wellKnownRoutes } from './.well-known/index.js';
import { docsRoutes } from './api/docs/index.js';
import { apiV1 } from './api/v1/index.js';
import { oauthApplicationRoutes } from './application/oauth/index.js';

export const routes = createRouter()
  .route('/api', docsRoutes)
  .route('/api/v1', apiV1)
  .route('/application/oauth', oauthApplicationRoutes)
  .route('/.well-known', wellKnownRoutes);

export type AppRouteType = typeof routes;
