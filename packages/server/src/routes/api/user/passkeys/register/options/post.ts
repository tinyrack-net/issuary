import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import type { AppEnv } from '../../../../../../lib/app-env.ts';
import { OPENAPI_SECURITY } from '../../../../../../lib/openapi.ts';
import { TAGS } from '../../../../../../lib/swagger-tags.ts';
import {
  verifyAuth,
  verifyPending2FASetupUser,
} from '../../../../../../middleware/auth.ts';
import { e } from '../../../../../../schemas/error.ts';
import { r } from '../../../../../../schemas/response.ts';

/**
 * POST /api/user/passkeys/register/options
 *
 * Generate WebAuthn registration options for registering a new passkey.
 */
export const userPasskeyRegisterOptionsPost = new Hono<AppEnv>().post(
  '/user/passkeys/register/options',
  describeRoute({
    tags: [TAGS.USER],
    security: OPENAPI_SECURITY.cookieSession,
    summary: 'Get Passkey Registration Options',
    description:
      'Generate WebAuthn registration options for registering a new passkey. ' +
      'Accepts both full user session and pending 2FA setup session.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(r.PasskeyRegistrationOptionsResponse),
          },
        },
        description: 'Success',
      },
      400: {
        content: {
          'application/json': {
            schema: resolver(e.PasskeyNotEnabled.Schema),
          },
        },
        description: 'Passkey not enabled',
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
  verifyAuth({ optional: true }),
  verifyPending2FASetupUser({ optional: true }),
  async (c) => {
    const config = c.var.services.config;
    if (!config.auth.passkey.enabled) {
      throw new e.PasskeyNotEnabled.Error();
    }

    const session = c.var.session;
    const { passkeyService } = c.var.services;

    const user =
      c.var.verifiedPending2FASetupUser?.user ?? c.var.verifiedUser?.user;

    if (!user) {
      throw new e.Unauthorized.Error();
    }

    // Config users cannot setup 2FA
    if (user.managed_by === 'config') {
      throw new e.SecondFactorNotAllowedForConfigUser.Error();
    }

    // Generate registration options
    const options = await passkeyService.generateRegistrationOptions(user);

    // Store challenge in session
    session.set('passkey_challenge', options.challenge);

    return c.json({ options }, 200);
  },
);
