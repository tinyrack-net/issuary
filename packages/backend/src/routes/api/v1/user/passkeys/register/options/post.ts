import { createRouter } from '@backend/lib/create-router.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { e } from '@backend/schemas/error.js';
import { r } from '@backend/schemas/response.js';
import { createRoute } from '@hono/zod-openapi';

/**
 * POST /api/v1/user/passkeys/register/options
 *
 * Generate WebAuthn registration options for registering a new passkey.
 */
const route = createRoute({
  method: 'post',
  path: '/user/passkeys/register/options',
  tags: [TAGS.USER],
  summary: 'Get Passkey Registration Options',
  description:
    'Generate WebAuthn registration options for registering a new passkey. ' +
    'Accepts both full user session and pending 2FA setup session.',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: r.PasskeyRegistrationOptionsResponse,
        },
      },
      description: 'Success',
    },
    400: {
      content: {
        'application/json': {
          schema: e.PasskeyNotEnabled.Schema,
        },
      },
      description: 'Passkey not enabled',
    },
    401: {
      content: {
        'application/json': {
          schema: e.Unauthorized.Schema,
        },
      },
      description: 'Unauthorized',
    },
    403: {
      content: {
        'application/json': {
          schema: e.SecondFactorNotAllowedForConfigUser.Schema,
        },
      },
      description: 'Second factor not allowed for config user',
    },
  },
});

export const userPasskeyRegisterOptionsPost = createRouter().openapi(
  route,
  async (c) => {
    const config = c.get('services').config;
    if (!config.auth.passkey.enabled) {
      throw new e.PasskeyNotEnabled.Error();
    }

    const session = c.get('session');
    const { mikro, passkeyService } = c.get('services');

    const userSession = session.get('user');
    const pending2FASetup = session.get('pending2FASetup');
    const userId = userSession?.id ?? pending2FASetup?.id;

    if (!userId) {
      throw new e.Unauthorized.Error();
    }

    // Get user entity for registration
    const user = await mikro.user.findOneOrFail(
      { id: userId },
      {
        failHandler: () => new e.UserNotFound.Error(),
      },
    );

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
