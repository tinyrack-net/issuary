import type { AppEnv } from '@backend/lib/app-env.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { e } from '@backend/schemas/error.js';
import { r } from '@backend/schemas/response.js';
import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';

export const authPasskeyOptionsPost = new Hono<AppEnv>().post(
  '/auth/passkey/options',
  describeRoute({
    tags: [TAGS.AUTH],
    summary: 'Get Passkey Authentication Options',
    description:
      'Generate WebAuthn authentication options for passkey login. ' +
      'Supports both passwordless login and 2FA. ' +
      'If a pending 2FA session exists, returns options for that user only.',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: resolver(r.PasskeyAuthenticationOptionsResponse),
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
    },
  }),
  async (c) => {
    const config = c.get('services').config;
    if (!config.auth.passkey.enabled) {
      throw new e.PasskeyNotEnabled.Error();
    }

    const session = c.get('session');
    const { passkeyService } = c.get('services');

    const pending2FAUser = session.get('pending2FAUser');

    const options = await passkeyService.generateAuthenticationOptions(
      pending2FAUser?.id,
    );

    session.set('passkey_challenge', options.challenge);

    return c.json({ options }, 200);
  },
);
