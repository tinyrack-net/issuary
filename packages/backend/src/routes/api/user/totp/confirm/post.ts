import type { AppEnv } from '@backend/lib/app-env.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
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
  async (c) => {
    const session = c.get('session');
    const { mikro, totpService, userService } = c.get('services');

    // Allow both full user session and pending 2FA setup session
    const userSession = session.get('user');
    const pending2FASetup = session.get('pending2FASetup');
    const userId = userSession?.id ?? pending2FASetup?.id;

    if (!userId) {
      throw new e.Unauthorized.Error();
    }

    await totpService.confirmSetup(userId);

    // Convert pending 2FA setup session to full user session
    if (pending2FASetup) {
      session.setUserSession(userId);
    }

    const userEntity = await mikro.user.verifyById(userId);
    const user = await userService.userEntityToSessionUser(userEntity);

    return c.json({ user }, 200);
  },
);
