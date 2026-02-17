import type { AppEnv } from '@backend/lib/app-env.js';
import { Hono } from 'hono';
import { healthGet } from './get.js';
import { healthLiveGet } from './live/get.js';
import { healthReadyGet } from './ready/get.js';

export const healthRoutes = new Hono<AppEnv>()
  .route('/', healthGet)
  .route('/', healthReadyGet)
  .route('/', healthLiveGet);
