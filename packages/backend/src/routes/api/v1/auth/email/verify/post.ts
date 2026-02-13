import { createRoute } from '@hono/zod-openapi';
import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { AppType } from '@/types.js';

const route = createRoute({
  method: 'post',
  path: '/auth/email/verify',
  tags: [TAGS.AUTH],
  summary: 'Verify Email',
  description: 'Verify user email with verification token',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            token: f.token,
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': { schema: r.AuthResponse },
      },
      description: 'Success',
    },
    400: {
      content: {
        'application/json': {
          schema: e.InvalidVerificationToken.Schema,
        },
      },
      description: 'Invalid verification token',
    },
  },
});

export default (app: AppType) => {
  app.openapi(route, async (c) => {
    const services = c.get('services');
    const session = c.get('session');

    if (!services.emailVerificationService) {
      throw new e.EmailNotActivated.Error();
    }

    const body = c.req.valid('json');

    const user = await services.emailVerificationService.verifyEmail(
      body.token,
    );

    await services.mikro.em.populate(user, ['password_hash']);

    const totpRegistered = await services.mikro.userTotp.isRegistered(user.id);
    const registeredPassKeyCount =
      await services.mikro.userPasskey.countByUserId(user.id);

    const secondFactorRequired =
      services.userService.user2FASetupRequired(user);
    const available2FAMethods =
      services.userService.getAvailable2FASetupMethods();

    const userSession: z.infer<typeof r.AuthResponse>['user'] = {
      id: user.id,
      managed_by: 'database' as const,
      email: user.email,
      email_verified: user.email_verified,
      email_verification_required:
        services.userService.userEmailVerificationRequired(user),
      has_password: user.hasPassword(),
      totp_registered: totpRegistered,
      second_factor_required: secondFactorRequired,
      passkey_count: registeredPassKeyCount,
    };

    if (
      secondFactorRequired &&
      !totpRegistered &&
      registeredPassKeyCount === 0 &&
      available2FAMethods.length > 0
    ) {
      session.setPending2FASetupSession(user.id);
      return c.json({ user: userSession }, 200);
    }

    session.setUserSession(user.id);
    return c.json({ user: userSession }, 200);
  });
};
