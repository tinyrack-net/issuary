import { RequestContext } from '@mikro-orm/core';
import { createMiddleware } from 'hono/factory';
import type { ServicesEnv } from './services.ts';

export const mikroOrmMiddleware = createMiddleware<ServicesEnv>(
  async (c, next) => {
    const services = c.var.services;
    await new Promise<void>((resolve, reject) => {
      RequestContext.create(services.mikro.orm.em, () => {
        next().then(resolve).catch(reject);
      });
    });
  },
);
