import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../../lib/app-env.ts';
import { OPENAPI_SECURITY } from '../../../../lib/openapi.ts';
import { TAGS } from '../../../../lib/swagger-tags.ts';
import { verifyAuth } from '../../../../middleware/auth.ts';
import { r } from '../../../../schemas/response.ts';

export const userSessionGet = new Hono<AppEnv>().get(
  '/user/session',
  describeRoute({
    tags: [TAGS.USER],
    security: OPENAPI_SECURITY.optionalCookieSession,
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
