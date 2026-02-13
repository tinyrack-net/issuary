import { createRoute, z } from '@hono/zod-openapi';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { r } from '@/schemas/response.js';
import type { AppType } from '@/types.js';

/**
 * POST /api/v1/user/totp/confirm
 *
 * Confirm TOTP setup after user acknowledges saving recovery codes.
 */
const route = createRoute({
  method: 'post',
  path: '/user/totp/confirm',
  tags: [TAGS.USER],
  summary: 'Confirm TOTP Setup',
  description:
    'Confirm that recovery codes have been saved to complete TOTP setup. ' +
    'Must call verify endpoint first to get recovery codes. ' +
    'This endpoint completes the TOTP setup and enables 2FA.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({}).optional().nullable(),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: r.UserSessionResponse,
        },
      },
      description: 'Success',
    },
    400: {
      content: {
        'application/json': {
          schema: e.TotpNotSetup.Schema,
        },
      },
      description: 'TOTP not setup',
    },
    401: {
      content: {
        'application/json': {
          schema: e.Unauthorized.Schema,
        },
      },
      description: 'Unauthorized',
    },
    409: {
      content: {
        'application/json': {
          schema: e.TotpAlreadyEnabled.Schema,
        },
      },
      description: 'TOTP already enabled',
    },
  },
});

export default (app: AppType) => {
  app.openapi(route, async (c) => {
    const session = c.get('session');
    const { mikro, totpService, userService } = c.get('services');

    // Allow both full user session and pending 2FA setup session
    const userSession = session.get('user');
    const pending2FASetup = session.get('pending2FASetup');
    const userId = userSession?.id ?? pending2FASetup?.id;

    if (!userId) {
      throw new e.Unauthorized.Error();
    }

    await totpService.confirmSetup(userId);

    // Convert pending 2FA setup session to full user session
    if (pending2FASetup) {
      session.setUserSession(userId);
    }

    const userEntity = await mikro.user.verifyById(userId);
    const user = await userService.userEntityToSessionUser(userEntity);

    return c.json({ user }, 200);
  });
};
