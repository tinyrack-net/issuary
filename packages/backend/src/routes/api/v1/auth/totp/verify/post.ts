import type { AppEnv } from '@backend/lib/app-env.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
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
  async (c) => {
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

    await totpService.verifyForAuth(pending2FAUser.id, body.code);

    const userEntity = await mikro.user.verifyById(pending2FAUser.id);
    const user = await userService.userEntityToSessionUser(userEntity);

    const authTime =
      pending2FAUser.authenticated_at ?? Math.floor(Date.now() / 1000);

    session.setUserSession(user.id, authTime);

    return c.json({ user }, 200);
  },
);
