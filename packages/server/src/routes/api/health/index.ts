import { Hono } from 'hono';
import type { AppEnv } from '../../../lib/app-env.ts';
import { healthGet } from './get.ts';
import { healthLiveGet } from './live/get.ts';
import { healthReadyGet } from './ready/get.ts';

export const healthRoutes = new Hono<AppEnv>()
  .route('/', healthGet)
  .route('/', healthReadyGet)
  .route('/', healthLiveGet);
