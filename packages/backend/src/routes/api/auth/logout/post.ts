import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import type { AppEnv } from '../../../../lib/app-env.ts';
import { TAGS } from '../../../../lib/swagger-tags.ts';
import { r } from '../../../../schemas/response.ts';

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
