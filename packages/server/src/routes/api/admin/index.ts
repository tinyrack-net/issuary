import { Hono } from 'hono';
import type { AppEnv } from '../../../lib/app-env.ts';
import { adminMeGet } from './me/get.ts';
import { adminUsersRoutes } from './users/index.ts';

export const adminRoutes = new Hono<AppEnv>()
  .use('/admin/*', async (c, next) => {
    if (!c.var.services.config.admin.enabled) {
      return c.json({ error: 'Not Found' }, 404);
    }
    return await next();
  })
  .route('/', adminMeGet)
  .route('/', adminUsersRoutes);
