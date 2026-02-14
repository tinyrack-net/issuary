import { createRouter } from '@backend/lib/create-router.js';
import { healthGet } from './get.js';
import { healthLiveGet } from './live/get.js';
import { healthReadyGet } from './ready/get.js';

export const healthRoutes = createRouter()
  .route('/', healthGet)
  .route('/', healthReadyGet)
  .route('/', healthLiveGet);
