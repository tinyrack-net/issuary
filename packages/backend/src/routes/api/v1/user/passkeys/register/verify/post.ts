import { createRoute } from '@hono/zod-openapi';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { r } from '@/schemas/response.js';
import type { AppType } from '@/types.js';

/**
 * POST /api/v1/user/passkeys/register/verify
 *
 * Verify and complete passkey registration.
 */
const route = createRoute({
  method: 'post',
  path: '/user/passkeys/register/verify',
  tags: [TAGS.USER],
  summary: 'Verify Passkey Registration',
  description:
    'Verify and complete passkey registration. ' +
    'Accepts both full user session and pending 2FA setup session.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: r.PasskeyRegistrationBody,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: r.PasskeySetupVerifyResponse,
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
      description:
        'Passkey not enabled, challenge not found, or verification failed',
    },
    401: {
      content: {
        'application/json': {
          schema: e.Unauthorized.Schema,
        },
      },
      description: 'Unauthorized',
    },
    409: {
      content: {
        'application/json': {
          schema: e.PasskeyAlreadyExists.Schema,
        },
      },
      description: 'Passkey already exists',
    },
  },
});

export default (app: AppType) => {
  app.openapi(route, async (c) => {
    const config = c.get('services').config;
    if (!config.auth.passkey.enabled) {
      throw new e.PasskeyNotEnabled.Error();
    }

    const body = c.req.valid('json');
    const session = c.get('session');
    const { mikro, passkeyService, userService } = c.get('services');

    // Allow both full user session and pending 2FA setup session
    const userSession = session.get('user');
    const pending2FASetup = session.get('pending2FASetup');
    const userId = userSession?.id ?? pending2FASetup?.id;

    if (!userId) {
      throw new e.Unauthorized.Error();
    }

    // Get challenge from session
    const challenge = session.get('passkey_challenge');
    if (!challenge) {
      throw new e.PasskeyChallengeNotFound.Error();
    }

    // Get user entity
    const user = await mikro.user.findOneOrFail({
      id: userId,
    });

    // Cast for @simplewebauthn compatibility
    const registrationResponse =
      body.response as unknown as RegistrationResponseJSON;

    // Verify registration
    await passkeyService.verifyRegistration(
      user,
      registrationResponse,
      challenge,
      body.name,
    );

    // Clear challenge from session
    session.set('passkey_challenge', undefined);

    // Check if this was from pending 2FA setup session
    const wasPendingSetup = !!pending2FASetup;

    if (wasPendingSetup) {
      // Clear pending setup sessions and create full user session
      session.setUserSession(userId);

      // Get user data for response
      const userEntity = await mikro.user.verifyById(userId);
      const userSessionData =
        await userService.userEntityToSessionUser(userEntity);

      return c.json(
        {
          ok: true as const,
          user: userSessionData,
          second_factor_setup_completed: true,
        },
        200,
      );
    }

    return c.json(
      {
        ok: true as const,
        second_factor_setup_completed: false,
      },
      200,
    );
  });
};
