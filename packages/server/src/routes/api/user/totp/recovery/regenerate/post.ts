import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../../../../lib/app-env.ts';
import { OPENAPI_SECURITY } from '../../../../../../lib/openapi.ts';
import { TAGS } from '../../../../../../lib/swagger-tags.ts';
import { verifyAuth } from '../../../../../../middleware/auth.ts';
import { e } from '../../../../../../schemas/error.ts';
import { f } from '../../../../../../schemas/field.ts';
import { r } from '../../../../../../schemas/response.ts';

export const userTotpRecoveryRegeneratePost = new Hono<AppEnv>().post(
  '/user/totp/recovery/regenerate',
  describeRoute({
    tags: [TAGS.USER],
    security: OPENAPI_SECURITY.cookieSession,
    summary: 'Regenerate TOTP recovery codes',
    description:
      'Generate a new set of single-use TOTP recovery codes for a user ' +
      'with fully enabled TOTP.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(r.RecoveryCodesResponse),
          },
        },
        description: 'Success',
      },
      400: {
        content: {
          'application/json': {
            schema: resolver(
              z.union([e.InvalidTotpCode.Schema, e.TotpNotEnabled.Schema]),
            ),
          },
        },
        description: 'TOTP not enabled or invalid TOTP code',
      },
      401: {
        content: {
          'application/json': {
            schema: resolver(e.Unauthorized.Schema),
          },
        },
        description: 'Unauthorized',
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
    const { config, totpService } = c.var.services;
    const { user } = c.var.verifiedUser;
    const body = c.req.valid('json');

    if (!config.auth.password.enabled || !config.auth.password.totp.enabled) {
      throw new e.ValidationError.Error('TOTP authentication is disabled');
    }

    const recoveryCodes = await totpService.regenerateRecoveryCodes(
      user.sub,
      body.code,
    );

    return c.json({ recovery_codes: recoveryCodes }, 200);
  },
);
