import { createRouter } from '@/lib/create-router.js';
import wellKnown from './.well-known/index.js';
import apiV1 from './api/v1/index.js';
import oauth from './application/oauth/index.js';

const routes = createRouter()
  .route('/api/v1', apiV1)
  .route('/application/oauth', oauth)
  .route('/.well-known', wellKnown);

export default routes;
