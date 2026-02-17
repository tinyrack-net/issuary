import type { AppEnv } from '@backend/lib/app-env.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import {
  verifyAuth,
  verifyPending2FASetupUser,
} from '@backend/middleware/auth.js';
import { e } from '@backend/schemas/error.js';
import { r } from '@backend/schemas/response.js';
import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';

/**
 * POST /api/user/totp/confirm
 *
 * Confirm TOTP setup after user acknowledges saving recovery codes.
 */
export const userTotpConfirmPost = new Hono<AppEnv>().post(
  '/user/totp/confirm',
  describeRoute({
    tags: [TAGS.USER],
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
  async (c) => {
    const session = c.var.session;
    const { mikro, totpService, userService } = c.var.services;

    // Allow both full user session and pending 2FA setup session
    const verifiedUser = c.var.verifiedUser;
    const verifiedPending2FASetupUser = c.var.verifiedPending2FASetupUser;
    const userId = verifiedUser?.id ?? verifiedPending2FASetupUser?.id;

    if (!userId) {
      throw new e.Unauthorized.Error();
    }

    await totpService.confirmSetup(userId);

    // Convert pending 2FA setup session to full user session
    if (verifiedPending2FASetupUser) {
      session.setUserSession(userId);
    }

    const userEntity = await mikro.user.verifyById(userId);
    const user = await userService.userEntityToSessionUser(userEntity);

    return c.json({ user }, 200);
  },
);
