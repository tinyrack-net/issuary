import { createRouter } from '@backend/lib/create-router.js';
import { TAGS } from '@backend/lib/swagger-tags.js';
import { e } from '@backend/schemas/error.js';
import { r } from '@backend/schemas/response.js';
import { createRoute } from '@hono/zod-openapi';

const route = createRoute({
  method: 'post',
  path: '/auth/passkey/options',
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
          schema: r.PasskeyAuthenticationOptionsResponse,
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
  },
});

export const authPasskeyOptionsPost = createRouter().openapi(
  route,
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
