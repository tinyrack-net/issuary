import { createMiddleware } from 'hono/factory';
import type { ServiceContainer } from '@/services/container.js';

export type ServicesEnv = { Variables: { services: ServiceContainer } };

export function servicesMiddleware(services: ServiceContainer) {
  return createMiddleware<ServicesEnv>(async (c, next) => {
    c.set('services', services);
    await next();
  });
}
