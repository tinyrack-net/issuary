import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import type { AppEnv } from '../../../../../lib/app-env.ts';
import { OPENAPI_SECURITY } from '../../../../../lib/openapi.ts';
import { TAGS } from '../../../../../lib/swagger-tags.ts';
import {
  verifyAuth,
  verifyPending2FASetupUser,
} from '../../../../../middleware/auth.ts';
import { e } from '../../../../../schemas/error.ts';
import { r } from '../../../../../schemas/response.ts';

/**
 * POST /api/user/totp/setup
 *
 * Start TOTP setup for the current user.
 * Generates a new secret and returns QR code for authenticator app.
 */
export const userTotpSetupPost = new Hono<AppEnv>().post(
  '/user/totp/setup',
  describeRoute({
    tags: [TAGS.USER],
    security: OPENAPI_SECURITY.cookieSession,
    summary: 'Start TOTP Setup',
    description:
      'Generate a new TOTP secret and QR code for authenticator app setup. ' +
      'Call verify endpoint after user scans the QR code to complete setup.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(r.TotpSetupResponse),
          },
        },
        description: 'Success',
      },
      401: {
        content: {
          'application/json': {
            schema: resolver(e.Unauthorized.Schema),
          },
        },
        description: 'Unauthorized',
      },
      400: {
        content: {
          'application/json': {
            schema: resolver(e.ValidationError.Schema),
          },
        },
        description: 'Validation error (for example when TOTP is disabled)',
      },
      403: {
        content: {
          'application/json': {
            schema: resolver(e.SecondFactorNotAllowedForConfigUser.Schema),
          },
        },
        description: 'Second factor not allowed for config user',
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
  verifyAuth({ optional: true }),
  verifyPending2FASetupUser({ optional: true }),
  async (c) => {
    const { config, totpService } = c.var.services;

    if (!config.auth.password.totp?.enabled) {
      throw new e.ValidationError.Error('TOTP is disabled');
    }

    const user =
      c.var.verifiedPending2FASetupUser?.user ?? c.var.verifiedUser?.user;

    if (!user) {
      throw new e.Unauthorized.Error();
    }

    // Config users cannot setup 2FA
    if (user.managed_by === 'config') {
      throw new e.SecondFactorNotAllowedForConfigUser.Error();
    }

    const setupData = await totpService.startSetup(user);

    return c.json(
      {
        secret: setupData.secret,
        otpauth_url: setupData.otpauthUrl,
        qr_code: setupData.qrCodeDataUrl,
      },
      200,
    );
  },
);
