import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../../../lib/app-env.ts';
import { OPENAPI_SECURITY } from '../../../../../lib/openapi.ts';
import { TAGS } from '../../../../../lib/swagger-tags.ts';
import { verifyPending2FAUser } from '../../../../../middleware/auth.ts';
import { e } from '../../../../../schemas/error.ts';
import { f } from '../../../../../schemas/field.ts';
import { r } from '../../../../../schemas/response.ts';

export const authTotpVerifyPost = new Hono<AppEnv>().post(
  '/auth/totp/verify',
  describeRoute({
    tags: [TAGS.AUTH],
    security: OPENAPI_SECURITY.cookieSession,
    summary: 'Verify TOTP for login',
    description:
      'Complete login by verifying TOTP code. Requires pending 2FA session from password login.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(r.UserSessionResponse),
          },
        },
        description: 'Success',
      },
      400: {
        content: {
          'application/json': {
            schema: resolver(e.ValidationError.Schema),
          },
        },
        description: 'Validation error or invalid TOTP code',
      },
      401: {
        content: {
          'application/json': {
            schema: resolver(e.SecondFactorSessionExpired.Schema),
          },
        },
        description: 'Second factor session expired',
      },
    },
  }),
  validator(
    'json',
    z.object({
      code: f.totpCode,
    }),
  ),
  verifyPending2FAUser(),
  async (c) => {
    const config = c.var.services.config;
    if (!config.auth.password.enabled || !config.auth.password.totp.enabled) {
      throw new e.ValidationError.Error('TOTP authentication is disabled');
    }

    const body = c.req.valid('json');
    const session = c.var.session;
    const { user: pending2FAUser, authenticatedAt } =
      c.var.verifiedPending2FAUser;
    const { mikro, userService, totpService } = c.var.services;

    await totpService.verifyForAuth(pending2FAUser.sub, body.code);

    session.setUserSession(pending2FAUser.sub, authenticatedAt);

    // Load full user data with relations for response
    const fullUser = await mikro.user.verifyBySub(pending2FAUser.sub);
    const userSession = await userService.userEntityToSessionUser(fullUser);

    return c.json({ user: userSession }, 200);
  },
);
