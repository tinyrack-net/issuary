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
    const user = c.get('verifiedUser');
    const { userService } = c.get('services');

    if (!user) {
      return c.json({ user: null }, 200);
    }

    const secondFactorRequired = userService.user2FASetupRequired(user);
    const available2FAMethods = userService.getAvailable2FASetupMethods();

    const needsSecondFactorSetup =
      secondFactorRequired &&
      available2FAMethods.length > 0 &&
      !user.totp_registered &&
      user.passkey_count === 0;

    const userSession = {
      id: user.id,
      managed_by: user.managed_by,
      email: user.email,
      email_verified: user.email_verified,
      email_verification_required:
        userService.userEmailVerificationRequired(user),
      has_password: user.has_password,
      totp_registered: user.totp_registered,
      second_factor_required: user.second_factor_required,
      passkey_count: user.passkey_count,
    };

    if (needsSecondFactorSetup) {
      return c.json({ user: userSession }, 200);
    }

    return c.json({ user: userSession }, 200);
  },
);
