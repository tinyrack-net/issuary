import { createRoute } from '@hono/zod-openapi';
import z from 'zod';
import { TAGS } from '@/lib/swagger-tags.js';
import { r } from '@/schemas/response.js';
import type { AppType } from '@/types.js';

const route = createRoute({
  method: 'get',
  path: '/user/session',
  tags: [TAGS.USER],
  summary: 'Get Session',
  description: 'Get Session',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            user: r.UserSession.optional(),
          }),
        },
      },
      description: 'Success',
    },
  },
});

export default (app: AppType) => {
  app.openapi(route, async (c) => {
    const auth = c.get('auth');
    const { userService } = c.get('services');

    try {
      const user = await auth.verify();

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
    } catch {
      return c.json({}, 200);
    }
  });
};
