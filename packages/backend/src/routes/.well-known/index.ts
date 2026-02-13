import type { AppType } from '@/lib/app.js';
import { createRouter } from '@/lib/create-router.js';
import openidConfigGet from './openid-configuration/get.js';

export function registerWellKnownRoutes(parentApp: AppType): void {
  const app = createRouter();
  openidConfigGet(app);
  parentApp.route('/.well-known', app);
}
