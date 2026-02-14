import type { ServiceContainer } from '@backend/services/container.js';
import { createMiddleware } from 'hono/factory';

export type ServicesEnv = { Variables: { services: ServiceContainer } };

export function servicesMiddleware(services: ServiceContainer) {
  return createMiddleware<ServicesEnv>(async (c, next) => {
    c.set('services', services);
    await next();
  });
}
