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
import { r } from '../../../../../schemas/response.ts';
import { withBrowserSecurity } from '../../../../../services/browser-security.service.js';

/**
 * POST /api/user/totp/confirm
 *
 * Confirm TOTP setup after user acknowledges saving recovery codes.
 */
export const userTotpConfirmPost = new Hono<AppEnv>().post(
  '/user/totp/confirm',
  describeRoute({
    tags: [TAGS.USER],
    security: OPENAPI_SECURITY.cookieSession,
    summary: 'Confirm TOTP Setup',
    description:
      'Confirm that recovery codes have been saved to complete TOTP setup. ' +
      'Must call verify endpoint first to get recovery codes. ' +
      'This endpoint completes the TOTP setup and enables 2FA.',
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
            schema: resolver(e.TotpNotSetup.Schema),
          },
        },
        description: 'TOTP not setup',
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
  validator('json', z.object({}).optional().nullable()),
  verifyAuth({ optional: true }),
  verifyPending2FASetupUser({ optional: true }),
  securityMutationDocumentation,
  async (c) => {
    return withBrowserSecurity(
      c,
      async () => {
        const session = c.var.session;
        const { mikro, totpService, userService } = c.var.services;

        // Allow both full user session and pending 2FA setup session
        const userSub =
          c.var.verifiedPending2FASetupUser?.user.sub ??
          c.var.verifiedUser?.user.sub;

        if (!userSub) {
          throw new e.Unauthorized.Error();
        }

        const totp = await mikro.userTotp.findVerifiedByUserSub(userSub);
        if (!totp) throw new e.TotpNotSetup.Error();
        if (totp.recovery_confirmed) throw new e.TotpAlreadyEnabled.Error();
        const proof = session.get('totpSetupVerification');
        if (
          !proof ||
          proof.sub !== userSub ||
          proof.totpId !== totp.id ||
          proof.step !== totp.last_used_step
        )
          throw new e.Unauthorized.Error();
        await totpService.confirmSetup(userSub);
        session.set('totpSetupVerification', undefined);

        // Convert pending 2FA setup session to full user session
        if (c.var.verifiedPending2FASetupUser) {
          session.setUserSession(
            userSub,
            session.get('security')?.grants[userSub] ?? '',
          );
        }

        const userEntity = await mikro.user.verifyBySub(userSub);
        const user = await userService.userEntityToSessionUser(userEntity);

        return c.json({ user }, 200);
      },
      { stage: 'setup' },
    );
  },
);
