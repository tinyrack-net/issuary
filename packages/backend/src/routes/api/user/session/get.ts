import type { AppEnv } from '@backend/lib/app-env.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { verifyAuth } from '@backend/middleware/auth.js';
import { r } from '@backend/schemas/response.js';
import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import { z } from 'zod';

export const userSessionGet = new Hono<AppEnv>().get(
  '/user/session',
  describeRoute({
    tags: [TAGS.USER],
    summary: 'Get Session',
    description: 'Get Session',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(
              z.object({
                user: r.UserSession.optional(),
              }),
            ),
          },
        },
        description: 'Success',
      },
    },
  }),
  verifyAuth({ optional: true }),
  async (c) => {
    const verifiedAuth = c.var.verifiedUser;
    const { mikro, userService } = c.var.services;

    if (!verifiedAuth) {
      return c.json({ user: null }, 200);
    }

    // Load full user data with relations for complete session response
    const fullUser = await mikro.user.verifyBySub(verifiedAuth.user.sub);
    const userSession = await userService.userEntityToSessionUser(fullUser);

    return c.json({ user: userSession }, 200);
  },
);
