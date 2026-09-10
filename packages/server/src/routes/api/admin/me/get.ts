import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../../lib/app-env.ts';
import { adminApiDocumentation } from '../../../../lib/openapi.ts';
import { TAGS } from '../../../../lib/swagger-tags.ts';
import { requireAdmin } from '../../../../middleware/auth.ts';
import { r } from '../../../../schemas/response.ts';

export const adminMeGet = new Hono<AppEnv>().get(
  '/admin/me',
  describeRoute({
    tags: [TAGS.ADMIN],
    summary: 'Get current admin',
    description: 'Get the current admin session identity.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(z.object({ user: r.UserSession })),
          },
        },
        description: 'Success',
      },
    },
  }),
  adminApiDocumentation,
  requireAdmin(),
  async (c) => {
    const { userService } = c.var.services;
    const fullUser = await c.var.services.mikro.user.verifyBySub(
      c.var.verifiedUser.user.sub,
    );
    const user = await userService.userEntityToSessionUser(fullUser);

    return c.json({ user }, 200);
  },
);
