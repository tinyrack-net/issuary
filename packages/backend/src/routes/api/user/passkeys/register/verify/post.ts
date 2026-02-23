import type { AppEnv } from '@backend/lib/app-env.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import {
  verifyAuth,
  verifyPasskeyChallenge,
  verifyPending2FASetupUser,
} from '@backend/middleware/auth.js';
import { e } from '@backend/schemas/error.js';
import { r } from '@backend/schemas/response.js';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';

/**
 * POST /api/user/passkeys/register/verify
 *
 * Verify and complete passkey registration.
 */
export const userPasskeyRegisterVerifyPost = new Hono<AppEnv>().post(
  '/user/passkeys/register/verify',
  describeRoute({
    tags: [TAGS.USER],
    summary: 'Verify Passkey Registration',
    description:
      'Verify and complete passkey registration. ' +
      'Accepts both full user session and pending 2FA setup session.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(r.PasskeySetupVerifyResponse),
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
        description:
          'Passkey not enabled, challenge not found, or verification failed',
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
            schema: resolver(e.PasskeyAlreadyExists.Schema),
          },
        },
        description: 'Passkey already exists',
      },
    },
  }),
  validator('json', r.PasskeyRegistrationBody),
  verifyAuth({ optional: true }),
  verifyPending2FASetupUser({ optional: true }),
  verifyPasskeyChallenge(),
  async (c) => {
    const config = c.var.services.config;
    if (!config.auth.passkey.enabled) {
      throw new e.PasskeyNotEnabled.Error();
    }

    const body = c.req.valid('json');
    const session = c.var.session;
    const { mikro, passkeyService, userService } = c.var.services;

    // Allow both full user session and pending 2FA setup session
    const verified = c.var.verifiedUser ?? c.var.verifiedPending2FASetupUser;

    if (!verified) {
      throw new e.Unauthorized.Error();
    }

    const user = verified.user;
    const userSub = user.sub;

    const challenge = c.var.verifiedPasskeyChallenge;

    // Cast for @simplewebauthn compatibility - Zod's inferred type
    // (Record<string, any>) is not structurally assignable to
    // @simplewebauthn's RegistrationResponseJSON due to index signature
    // differences. The refine() above validates the structure at runtime.
    const registrationResponse =
      body.response as unknown as RegistrationResponseJSON;

    // Verify registration
    await passkeyService.verifyRegistration(
      user,
      registrationResponse,
      challenge,
      body.name,
    );

    // Check if this was from pending 2FA setup session
    const wasPendingSetup = !!c.var.verifiedPending2FASetupUser;

    if (wasPendingSetup) {
      // Clear pending setup sessions and create full user session
      session.setUserSession(userSub);

      // Get user data for response
      const userEntity = await mikro.user.verifyBySub(userSub);
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
  },
);
