import type { AppEnv } from '@backend/lib/app-env.js';
import { OPENAPI_SECURITY } from '@backend/lib/openapi.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { verifyPending2FAUser } from '@backend/middleware/auth.js';
import { e } from '@backend/schemas/error.js';
import { f } from '@backend/schemas/field.js';
import { r } from '@backend/schemas/response.js';
import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';

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
