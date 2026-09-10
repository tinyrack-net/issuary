import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../../../lib/app-env.ts';
import {
  OPENAPI_SECURITY,
  securityMutationDocumentation,
} from '../../../../../lib/openapi.ts';
import { TAGS } from '../../../../../lib/swagger-tags.ts';
import {
  verifyAuth,
  verifyPending2FASetupUser,
} from '../../../../../middleware/auth.ts';
import { e } from '../../../../../schemas/error.ts';
import { f } from '../../../../../schemas/field.ts';
import { r } from '../../../../../schemas/response.ts';
import { withBrowserSecurity } from '../../../../../services/browser-security.service.js';

/**
 * POST /api/user/totp/verify
 *
 * Verify TOTP code during setup.
 */
export const userTotpVerifyPost = new Hono<AppEnv>().post(
  '/user/totp/verify',
  describeRoute({
    tags: [TAGS.USER],
    security: OPENAPI_SECURITY.cookieSession,
    summary: 'Verify TOTP Setup',
    description:
      'Verify the TOTP code from authenticator app. ' +
      'Must call setup endpoint first to get the QR code. ' +
      'Returns one-time recovery codes. Call confirm endpoint after ' +
      'user acknowledges saving the recovery codes to complete setup.',
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
            schema: resolver(e.TotpNotSetup.Schema),
          },
        },
        description: 'TOTP not setup or invalid TOTP code',
      },
      401: {
        content: {
          'application/json': {
            schema: resolver(e.Unauthorized.Schema),
          },
        },
        description: 'Unauthorized',
      },
      409: {
        content: {
          'application/json': {
            schema: resolver(e.TotpAlreadyEnabled.Schema),
          },
        },
        description: 'TOTP already enabled',
      },
    },
  }),
  validator(
    'json',
    z.object({
      code: f.totpCode,
    }),
  ),
  verifyAuth({ optional: true }),
  verifyPending2FASetupUser({ optional: true }),
  securityMutationDocumentation,
  async (c) => {
    return withBrowserSecurity(
      c,
      async () => {
        const body = c.req.valid('json');
        const { totpService, mikro } = c.var.services;

        // Allow both full user session and pending 2FA setup session
        const userSub =
          c.var.verifiedPending2FASetupUser?.user.sub ??
          c.var.verifiedUser?.user.sub;

        if (!userSub) {
          throw new e.Unauthorized.Error();
        }

        const recoveryCodes = await totpService.verifySetup(userSub, body.code);

        const totp = await mikro.userTotp.findByUserSub(userSub);
        if (!totp || typeof totp.last_used_step !== 'number')
          throw new e.TotpNotSetup.Error();
        c.var.session.set('totpSetupVerification', {
          sub: userSub,
          totpId: totp.id,
          step: totp.last_used_step,
        });
        return c.json({ recovery_codes: recoveryCodes }, 200);
      },
      { stage: 'setup' },
    );
  },
);
