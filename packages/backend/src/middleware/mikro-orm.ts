import { RequestContext } from '@mikro-orm/core';
import { createMiddleware } from 'hono/factory';
import type { ServicesEnv } from './services.js';

export const mikroOrmMiddleware = createMiddleware<ServicesEnv>(
  async (c, next) => {
    const services = c.get('services');
    await new Promise<void>((resolve, reject) => {
      RequestContext.create(services.mikro.orm.em, () => {
        next().then(resolve).catch(reject);
      });
    });
  },
);
