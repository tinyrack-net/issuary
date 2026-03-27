import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { Hono } from 'hono';
import { describeRoute, resolver, validator } from 'hono-openapi';
import { z } from 'zod';
import type { AppEnv } from '../../../../../lib/app-env.ts';
import { OPENAPI_SECURITY } from '../../../../../lib/openapi.ts';
import { TAGS } from '../../../../../lib/swagger-tags.ts';
import {
  verifyPasskeyChallenge,
  verifyPending2FAUser,
} from '../../../../../middleware/auth.ts';
import { e } from '../../../../../schemas/error.ts';
import { r } from '../../../../../schemas/response.ts';

export const authPasskeyVerifyPost = new Hono<AppEnv>().post(
  '/auth/passkey/verify',
  describeRoute({
    tags: [TAGS.AUTH],
    security: OPENAPI_SECURITY.cookieSession,
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
  verifyPasskeyChallenge(),
  async (c) => {
    const config = c.var.services.config;
    if (!config.auth.passkey.enabled) {
      throw new e.PasskeyNotEnabled.Error();
    }

    const body = c.req.valid('json');
    const session = c.var.session;
    const { mikro, passkeyService, userService } = c.var.services;

    const pending2FA = c.var.verifiedPending2FAUser;
    const challenge = c.var.verifiedPasskeyChallenge;

    // Cast for @simplewebauthn compatibility - Zod's inferred type
    // differs from @simplewebauthn's AuthenticationResponseJSON due to
    // exactOptionalPropertyTypes (userHandle?: string | undefined vs string).
    const authResponse = body.response as AuthenticationResponseJSON;

    const passkeyUser = await passkeyService.verifyAuthentication(
      authResponse,
      challenge,
    );

    if (pending2FA && passkeyUser.sub !== pending2FA.user.sub) {
      throw new e.PasskeyUserMismatch.Error();
    }

    const userEntity = await mikro.user.verifyBySub(passkeyUser.sub);
    const sessionUser = await userService.userEntityToSessionUser(userEntity);

    const authTime =
      pending2FA?.authenticatedAt ?? Math.floor(Date.now() / 1000);

    session.setUserSession(passkeyUser.sub, authTime);

    return c.json({ user: sessionUser }, 200);
  },
);
