import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '#backend/lib/app-env.js';
import { OPENAPI_SECURITY } from '#backend/lib/openapi.js';
import { TAGS } from '#backend/lib/swagger-tags.js';
import { verifyAuth } from '#backend/middleware/auth.js';
import { e } from '#backend/schemas/error.js';
import { f } from '#backend/schemas/field.js';
import { r } from '#backend/schemas/response.js';

/**
 * DELETE /api/user/totp
 *
 * Disable TOTP two-factor authentication.
 */
export const userTotpDelete = new Hono<AppEnv>().delete(
  '/user/totp',
  describeRoute({
    tags: [TAGS.USER],
    security: OPENAPI_SECURITY.cookieSession,
    summary: 'Disable TOTP',
    description:
      'Disable TOTP two-factor authentication for the current user. ' +
      'Requires a valid TOTP code from the authenticator app.',
    responses: {
      200: {
        content: {
          'application/json': { schema: resolver(r.OkResponse) },
        },
        description: 'Success',
      },
      400: {
        content: {
          'application/json': {
            schema: resolver(e.TotpNotEnabled.Schema),
          },
        },
        description:
          'TOTP not enabled, invalid code, or cannot remove last second factor',
      },
      401: {
        content: {
          'application/json': {
            schema: resolver(e.Unauthorized.Schema),
          },
        },
        description: 'Unauthorized',
      },
      403: {
        content: {
          'application/json': {
            schema: resolver(e.SecondFactorNotAllowedForConfigUser.Schema),
          },
        },
        description: 'Second factor not allowed for config user',
      },
    },
  }),
  validator(
    'json',
    z.object({
      code: f.totpCode,
    }),
  ),
  verifyAuth(),
  async (c) => {
    const body = c.req.valid('json');
    const { user: userEntity } = c.var.verifiedUser;
    const { config, mikro, totpService } = c.var.services;

    // Config users cannot manage 2FA
    if (userEntity.managed_by === 'config') {
      throw new e.SecondFactorNotAllowedForConfigUser.Error();
    }

    // Check if 2FA is required
    const secondFactorRequired = config.auth.password.second_factor.required;

    // Check if user has other 2FA method (passkey)
    const passkeyCount = await mikro.userPasskey.countByUserSub(userEntity.sub);
    const hasOtherSecondFactor = passkeyCount > 0;

    await totpService.disable(userEntity.sub, body.code, {
      secondFactorRequired,
      hasOtherSecondFactor,
    });

    return c.json({ ok: true as const }, 200);
  },
);
