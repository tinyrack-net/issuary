import { createRoute } from '@hono/zod-openapi';
import { TAGS } from '@/lib/swagger-tags.js';
import { r } from '@/schemas/response.js';
import type { AppType } from '@/types.js';

const route = createRoute({
  method: 'post',
  path: '/auth/logout',
  tags: [TAGS.AUTH],
  summary: 'Logout',
  description: 'Logout the current user and purge the session',
  responses: {
    200: {
      content: {
        'application/json': { schema: r.OkResponse },
      },
      description: 'Success',
    },
  },
});

export default (app: AppType) => {
  app.openapi(route, async (c) => {
    c.get('session').delete();
    return c.json({ ok: true as const }, 200);
  });
};
