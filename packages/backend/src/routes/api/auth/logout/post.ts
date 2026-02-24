import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import type { AppEnv } from '#backend/lib/app-env.js';
import { TAGS } from '#backend/lib/swagger-tags.js';
import { r } from '#backend/schemas/response.js';

export const authLogoutPost = new Hono<AppEnv>().post(
  '/auth/logout',
  describeRoute({
    tags: [TAGS.AUTH],
    summary: 'Logout',
    description: 'Logout the current user and purge the session',
    responses: {
      200: {
        content: {
          'application/json': { schema: resolver(r.OkResponse) },
        },
        description: 'Success',
      },
    },
  }),
  async (c) => {
    c.var.session.delete();
    return c.json({ ok: true as const }, 200);
  },
);
