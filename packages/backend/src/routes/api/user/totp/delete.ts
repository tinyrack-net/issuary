import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../../lib/app-env.ts';
import { OPENAPI_SECURITY } from '../../../../lib/openapi.ts';
import { TAGS } from '../../../../lib/swagger-tags.ts';
import { verifyAuth } from '../../../../middleware/auth.ts';
import { e } from '../../../../schemas/error.ts';
import { f } from '../../../../schemas/field.ts';
import { r } from '../../../../schemas/response.ts';

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
    const secondFactorRequired =
      config.auth.password.two_factor.enrollment_required;

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
