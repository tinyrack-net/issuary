import type { AppType } from '@/lib/app.js';
import { registerWellKnownRoutes } from './.well-known/index.js';
import { registerApiV1Routes } from './api/v1/index.js';
import { registerOAuthRoutes } from './application/oauth/index.js';

export function registerRoutes(app: AppType): void {
  registerApiV1Routes(app);
  registerOAuthRoutes(app);
  registerWellKnownRoutes(app);
}
