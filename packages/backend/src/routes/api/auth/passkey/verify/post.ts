import type { AppEnv } from '@backend/lib/app-env.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { verifyPending2FAUser } from '@backend/middleware/auth.js';
import { e } from '@backend/schemas/error.js';
import { r } from '@backend/schemas/response.js';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';

export const authPasskeyVerifyPost = new Hono<AppEnv>().post(
  '/auth/passkey/verify',
  describeRoute({
    tags: [TAGS.AUTH],
    summary: 'Verify Passkey Authentication',
    description:
      'Verify WebAuthn authentication response and create session. ' +
      'Supports both passwordless login and 2FA. ' +
      'If a pending 2FA session exists, verifies the passkey belongs to ' +
      'that user and completes the 2FA flow.',
    responses: {
      200: {
        content: {
          'application/json': { schema: resolver(r.AuthResponse) },
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
      403: {
        content: {
          'application/json': {
            schema: resolver(e.PasskeyUserMismatch.Schema),
          },
        },
        description: 'Passkey user mismatch',
      },
      404: {
        content: {
          'application/json': {
            schema: resolver(e.PasskeyNotFound.Schema),
          },
        },
        description: 'Passkey not found',
      },
    },
  }),
  validator(
    'json',
    z.object({
      response: r.AuthenticationResponseJSON,
    }),
  ),
  verifyPending2FAUser({ optional: true }),
  async (c) => {
    const config = c.var.services.config;
    if (!config.auth.passkey.enabled) {
      throw new e.PasskeyNotEnabled.Error();
    }

    const body = c.req.valid('json');
    const session = c.var.session;
    const { mikro, passkeyService, userService } = c.var.services;

    const pending2FAUser = c.var.verifiedPending2FAUser;

    // Get challenge from session
    const challenge = session.get('passkey_challenge');

    if (!challenge) {
      throw new e.PasskeyChallengeNotFound.Error();
    }

    session.set('passkey_challenge', undefined);

    // Cast for @simplewebauthn compatibility - Zod's inferred type
    // differs from @simplewebauthn's AuthenticationResponseJSON due to
    // exactOptionalPropertyTypes (userHandle?: string | undefined vs string).
    const authResponse = body.response as AuthenticationResponseJSON;

    const passkeyUser = await passkeyService.verifyAuthentication(
      authResponse,
      challenge,
    );

    if (pending2FAUser && passkeyUser.id !== pending2FAUser.id) {
      throw new e.PasskeyUserMismatch.Error();
    }

    const userEntity = await mikro.user.verifyById(passkeyUser.id);
    const sessionUser = await userService.userEntityToSessionUser(userEntity);

    const authTime =
      session.get('pending2FAUser')?.authenticated_at ??
      Math.floor(Date.now() / 1000);

    session.setUserSession(passkeyUser.id, authTime);

    return c.json({ user: sessionUser }, 200);
  },
);
