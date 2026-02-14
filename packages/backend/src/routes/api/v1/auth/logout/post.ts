import { createRoute } from '@hono/zod-openapi';
import { createRouter } from '@/lib/create-router.js';
import { TAGS } from '@/lib/swagger-tags.js';
import { r } from '@/schemas/response.js';

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

export default createRouter().openapi(route, async (c) => {
  c.get('session').delete();
  return c.json({ ok: true as const }, 200);
});
