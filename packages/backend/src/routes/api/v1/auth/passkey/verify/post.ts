import { createRoute, z } from '@hono/zod-openapi';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { createRouter } from '@/lib/create-router.js';
import { TAGS } from '@/lib/swagger-tags.js';
import { e } from '@/schemas/error.js';
import { r } from '@/schemas/response.js';

const route = createRoute({
  method: 'post',
  path: '/auth/passkey/verify',
  tags: [TAGS.AUTH],
  summary: 'Verify Passkey Authentication',
  description:
    'Verify WebAuthn authentication response and create session. ' +
    'Supports both passwordless login and 2FA. ' +
    'If a pending 2FA session exists, verifies the passkey belongs to ' +
    'that user and completes the 2FA flow.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            response: r.AuthenticationResponseJSON,
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': { schema: r.AuthResponse },
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
    403: {
      content: {
        'application/json': {
          schema: e.PasskeyUserMismatch.Schema,
        },
      },
      description: 'Passkey user mismatch',
    },
    404: {
      content: {
        'application/json': {
          schema: e.PasskeyNotFound.Schema,
        },
      },
      description: 'Passkey not found',
    },
  },
});

export default createRouter().openapi(route, async (c) => {
  const config = c.get('services').config;
  if (!config.auth.passkey.enabled) {
    throw new e.PasskeyNotEnabled.Error();
  }

  const body = c.req.valid('json');
  const session = c.get('session');
  const { mikro, passkeyService, userService } = c.get('services');

  const pending2FAUser = session.get('pending2FAUser');

  // Get challenge from session
  const challenge = session.get('passkey_challenge');

  if (!challenge) {
    throw new e.PasskeyChallengeNotFound.Error();
  }

  session.set('passkey_challenge', undefined);

  // Extract and cast the validated response
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
    pending2FAUser?.authenticated_at ?? Math.floor(Date.now() / 1000);

  session.setUserSession(passkeyUser.id, authTime);

  return c.json({ user: sessionUser }, 200);
});
