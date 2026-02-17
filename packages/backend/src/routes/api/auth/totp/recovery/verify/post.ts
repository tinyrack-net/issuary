import type { AppEnv } from '@backend/lib/app-env.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { verifyPending2FAUser } from '@backend/middleware/auth.js';
import { e } from '@backend/schemas/error.js';
import { f } from '@backend/schemas/field.js';
import { r } from '@backend/schemas/response.js';
import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';

/**
 * POST /api/auth/totp/recovery/verify
 *
 * Complete login by verifying a TOTP recovery code.
 * Requires pending 2FA session from password login.
 * Each recovery code is single-use and invalidated upon use.
 */
export const authTotpRecoveryVerifyPost = new Hono<AppEnv>().post(
  '/auth/totp/recovery/verify',
  describeRoute({
    tags: [TAGS.AUTH],
    summary: 'Verify TOTP recovery code for login',
    description:
      'Complete login by verifying a one-time TOTP recovery code. ' +
      'Requires pending 2FA session from password login. ' +
      'Each recovery code can only be used once.',
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
        description:
          'Validation error, invalid recovery code, no recovery codes available, or TOTP not enabled',
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
      code: f.recoveryCode,
    }),
  ),
  verifyPending2FAUser(),
  async (c) => {
    const config = c.get('services').config;
    if (!config.auth.password.enabled || !config.auth.password.totp.enabled) {
      throw new e.ValidationError.Error('TOTP authentication is disabled');
    }

    const body = c.req.valid('json');
    const session = c.get('session');
    const pending2FAUser = c.get('verifiedPending2FAUser');
    const { totpService } = c.get('services');

    await totpService.verifyRecoveryCode(pending2FAUser.id, body.code);

    const authTime =
      session.get('pending2FAUser')?.authenticated_at ??
      Math.floor(Date.now() / 1000);

    session.setUserSession(pending2FAUser.id, authTime);

    return c.json({ user: pending2FAUser }, 200);
  },
);
