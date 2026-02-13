import { createRoute } from '@hono/zod-openapi';
import z from 'zod/v4';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { f } from '@/schemas/field.js';
import { r } from '@/schemas/response.js';
import type { AppType } from '@/types.js';

/**
 * POST /api/v1/auth/totp/recovery/verify
 *
 * Complete login by verifying a TOTP recovery code.
 * Requires pending 2FA session from password login.
 * Each recovery code is single-use and invalidated upon use.
 */
const route = createRoute({
  method: 'post',
  path: '/auth/totp/recovery/verify',
  tags: [TAGS.AUTH],
  summary: 'Verify TOTP recovery code for login',
  description:
    'Complete login by verifying a one-time TOTP recovery code. ' +
    'Requires pending 2FA session from password login. ' +
    'Each recovery code can only be used once.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            code: f.recoveryCode,
          }),
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
          schema: e.ValidationError.Schema,
        },
      },
      description:
        'Validation error, invalid recovery code, no recovery codes available, or TOTP not enabled',
    },
    401: {
      content: {
        'application/json': {
          schema: e.SecondFactorSessionExpired.Schema,
        },
      },
      description: 'Second factor session expired',
    },
  },
});

export default (app: AppType) => {
  app.openapi(route, async (c) => {
    const config = c.get('services').config;
    if (!config.auth.password.enabled || !config.auth.password.totp.enabled) {
      throw new e.ValidationError.Error('TOTP authentication is disabled');
    }

    const body = c.req.valid('json');
    const session = c.get('session');
    const { mikro, totpService, userService } = c.get('services');

    const pending2FAUser = session.get('pending2FAUser');

    if (!pending2FAUser) {
      throw new e.SecondFactorSessionExpired.Error();
    }

    await totpService.verifyRecoveryCode(pending2FAUser.id, body.code);

    const userEntity = await mikro.user.verifyById(pending2FAUser.id);
    const user = await userService.userEntityToSessionUser(userEntity);

    const authTime =
      pending2FAUser.authenticated_at ?? Math.floor(Date.now() / 1000);

    session.setUserSession(user.id, authTime);

    return c.json({ user }, 200);
  });
};
